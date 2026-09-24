import zlib
import io
from mutagen import File as MutagenFile

from app.settings import openai_client, logger

SYSTEM_PROMPT_TRANSLATE_CLEAN = """
You are a transcript translator and cleaning tool for real estate home loan sales field call recordings.
The input is a RAW transcript from Whisper AI speech-to-text. It may be in Tamil, Telugu, Hindi, Kannada,
English, or a MIX of these within the same sentence — code-switching between languages is common and expected.

YOUR JOB, IN THIS ORDER:
1. TRANSLATE the entire transcript into natural, clear English. Translate every non-English word or phrase.
   Do not leave any Tamil/Telugu/Hindi/Kannada words untranslated, EXCEPT proper nouns (customer names,
   agent names, place names), which must stay exactly as heard.
2. REMOVE filler words (see rules below). Nothing else.

⚠️ ANTI-TRUNCATION MANDATE (HIGHEST PRIORITY):
The speaker ALWAYS ends with a CRM action instruction (e.g. "capture this in CRM", "take this for further").
You MUST preserve every single word until the absolute last syllable.
If the final sentence sounds incomplete, still include it exactly as heard.
NEVER drop, rephrase, or shorten the last sentence — it contains critical business instructions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMOVE ONLY THESE FILLER WORDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- English fillers : um, uh, ah, oh, hmm
- Indian fillers  : haan, acha, arre, bas, achha
- Repetitions     : "okay okay", "yeah yeah", "so so", "like like"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEVER TOUCH THESE — EVER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Numbers         : phone numbers, flat numbers, floor numbers
- Money amounts   : "45 lakhs", "1.2 crore", "50K", "budget is 80"
- Names           : customer names, agent names, place names
- Loan terms      : "loan", "EMI", "down payment", "finance", "pre-approved"
- Property terms  : "BHK", "villa", "plot", "site visit", "possession"
- Locations       : any city, area, landmark, or project name
- CRM instructions: "capture in CRM", "take up for further", "login", any action item

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDUSTRY TERM CORRECTIONS (MANDATORY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- If you see the word "civil" used in the context of loans, credit, or records (e.g., "check their civil", "civil score"), you MUST correct it to "CIBIL".
- If you see the phrase "newly login" or similar phrases about logging in a new file/customer, you MUST correct it strictly to "new lead login".
- Do not make any other vocabulary changes unless specified here.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Translate FAITHFULLY. Do not paraphrase, polish, or "improve" the sentence beyond a literal translation
   — even if the resulting English sounds broken or ungrammatical. If a sentence was already in English,
   leave it exactly as-is (do not reword it).
   BAD  → "I need loan" becomes "I need a loan"   ← forbidden, adds "a" that wasn't spoken
   GOOD → "I need loan"                            ← leave exactly as-is

2. DO NOT fix grammar, punctuation, or sentence structure beyond what plain translation requires.

3. DO NOT add ANY words/phrases that have no corresponding words in the original transcript.
   This includes: "Thank you", "Goodbye", "Sure", "Of course", or any closing phrase the speaker never said.

4. DO NOT summarize, shorten, or combine sentences.

5. The LAST SENTENCE is sacred — translate it in full, preserving every word's meaning, even if it sounds incomplete.
   BAD  → "Capture this information in CRM so we can take up this for further" becomes "We can take this information from CRM" ← forbidden, rephrased + truncated
   GOOD → translate the full sentence completely, with nothing dropped or summarized

6. If the transcript is 1–2 words, you MUST still return the translated + cleaned version. Never refuse.

7. If the transcript is already fully in English with NO fillers, return it COMPLETELY UNCHANGED.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY the cleaned transcript.
No explanations. No notes. No labels. Nothing else.
"""


def is_repetition_loop(text, threshold=6.0):
    """
    Detects a degenerate transcription (the model stuck repeating the same
    phrase over and over instead of transcribing). Uses a compression-ratio
    heuristic: highly repetitive text compresses far smaller than normal
    speech does. Threshold calibrated against real calls in this domain —
    natural conversation (including chatty, repetition-heavy Indian business
    calls with lots of "yeah yeah" / "okay okay" / "sure sure") measured
    1.7-2.6x, while an actual stuck-loop failure measured 300x+. 6.0 leaves
    wide margin above real speech while still catching genuine loops early.
    """
    if not text or len(text) < 200:
        return False
    encoded = text.encode("utf-8")
    compressed = zlib.compress(encoded)
    compression_ratio = len(encoded) / len(compressed)
    return compression_ratio > threshold


def get_audio_duration_seconds(content):
    """Reads audio duration from file metadata (no external binary needed)."""
    try:
        audio = MutagenFile(io.BytesIO(content))
        if audio is not None and audio.info is not None:
            return audio.info.length
    except Exception as e:
        logger.warning(f"Could not read audio duration: {e}")
    return None


def is_transcript_too_short(text, duration_seconds, min_words_per_second=0.5, min_duration_to_check=8):
    """
    Flags a transcript that has far fewer words than a recording of this
    length should reasonably produce — e.g. 2 words for a 2-minute call.
    Normal speech is ~2-3 words/second; 0.5 is a lenient floor to avoid
    false positives on slower or pause-heavy calls.
    """
    if duration_seconds is None or duration_seconds < min_duration_to_check:
        return False
    word_count = len(text.split()) if text else 0
    expected_min_words = duration_seconds * min_words_per_second
    return word_count < expected_min_words


def transcribe_audio(filename, content, prompt):
    """
    Transcribes audio via gpt-4o-transcribe. If the model gets stuck in a
    repetition loop, or gives up early and returns far too little text for
    the recording's length (both known failure modes on noisy/unclear audio,
    worsened by temperature=0's fully deterministic decoding), retries once
    at a higher temperature, which often breaks the failure.
    """
    duration = get_audio_duration_seconds(content)

    def _failed(text):
        return is_repetition_loop(text) or is_transcript_too_short(text, duration)

    raw_text = openai_client.audio.transcriptions.create(
        file=(filename, content),
        model="gpt-4o-transcribe",
        response_format="text",
        temperature=0,
        prompt=prompt
    )

    if _failed(raw_text):
        logger.warning("Transcription looks broken (loop or too-short) — retrying at higher temperature")
        raw_text = openai_client.audio.transcriptions.create(
            file=(filename, content),
            model="gpt-4o-transcribe",
            response_format="text",
            temperature=0.4,
            prompt=prompt
        )

    return raw_text, _failed(raw_text)


def translate_and_clean(raw_text):
    clean_res = openai_client.chat.completions.create(
        messages=[{"role": "system", "content": SYSTEM_PROMPT_TRANSLATE_CLEAN}, {"role": "user", "content": raw_text}],
        model="gpt-4o-mini",
        temperature=0
    )
    return clean_res.choices[0].message.content.strip()
