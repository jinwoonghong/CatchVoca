/**
 * Offscreen Document for Clipboard Access
 * Service Worker는 navigator.clipboard에 접근할 수 없으므로
 * offscreen document를 사용하여 클립보드 읽기
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'READ_CLIPBOARD_OFFSCREEN') {
    handleClipboardRead(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleClipboardRead(sendResponse: (response: any) => void): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    console.log('[CatchVoca Offscreen] Clipboard read successful:', text);
    sendResponse({ success: true, text });
  } catch (error) {
    console.error('[CatchVoca Offscreen] Failed to read clipboard:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

console.log('[CatchVoca Offscreen] Document loaded');
