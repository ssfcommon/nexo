// ── Google Drive Image Upload via Apps Script ──────────────────
// Same pattern as Farlo / XPNS — uploads base64 images to Google Drive
// through a Google Apps Script web app endpoint.

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz81YCaJxvu69-ezn6xY8MU51JLT0S21euye6IRm6BwTjwKZXocESvCJMT29_HNO7SwLQ/exec';

const DRIVE_FOLDER_ID = '1ZXW7A8YXAMaGtd_5wfbMqiVWqwuFA_9A';

/**
 * Upload a base64 data URL image to Google Drive via Apps Script.
 *
 * @param {string} dataUrl  – "data:image/png;base64,..." or "data:image/jpeg;base64,..."
 * @param {string} subfolder – subfolder inside the Drive folder, e.g. "Nexo/Avatars" or "Nexo/Bug-Screenshots"
 * @param {string} [filename] – optional filename (without extension)
 * @returns {Promise<string>} – public Google Drive URL of the uploaded file
 */
export async function uploadToDrive(dataUrl, subfolder, filename) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL for Drive upload');

  const mimeType = match[1];
  const base64Data = match[2];
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const finalName = filename ? `${filename}.${ext}` : `upload-${Date.now()}.${ext}`;

  const payload = {
    action: 'uploadImage',
    folderId: DRIVE_FOLDER_ID,
    subfolder: subfolder,
    fileName: finalName,
    mimeType: mimeType,
    base64Data: base64Data,
  };

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  if (!res.ok) {
    // Apps Script redirects on POST — if fetch didn't follow, try text
    const text = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }

  const result = await res.json();

  if (result.error) {
    throw new Error(`Drive upload error: ${result.error}`);
  }

  // Apps Script returns { success: true, url: "https://drive.google.com/..." }
  return result.url;
}
