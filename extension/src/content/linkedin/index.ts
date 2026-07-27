import { linkedInChannel } from '../../channels/linkedin.js';
import { MSG } from '../../shared/types.js';

const channel = linkedInChannel;

function extractAndNotify() {
  if (!channel.detect({ url: location.href, hostname: location.hostname, pathname: location.pathname })) {
    return;
  }
  const profile = channel.extractProfile();
  if (!profile) return;
  chrome.runtime.sendMessage({
    type: MSG.PROFILE_EXTRACTED,
    profile,
    channelSlug: channel.slug,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MSG.INSERT_MESSAGE && typeof message.content === 'string') {
    const success = channel.insertMessage(message.content);
    sendResponse({ type: MSG.MESSAGE_INSERTED, success });
    return true;
  }
  if (message.type === 'EXTRACT_PROFILE') {
    const profile = channel.extractProfile();
    sendResponse({ profile });
    return true;
  }
  return false;
});

// Extraction initiale + observation DOM (SPA LinkedIn)
extractAndNotify();
const observer = new MutationObserver(() => {
  extractAndNotify();
});
observer.observe(document.body, { childList: true, subtree: true });
