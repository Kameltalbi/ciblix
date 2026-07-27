import { MSG } from '../shared/types.js';
import { getValidSession } from '../shared/auth.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MSG.GET_AUTH_TOKEN) {
    getValidSession().then((session) => {
      sendResponse({
        type: MSG.AUTH_TOKEN,
        token: session?.accessToken ?? null,
        apiBase: session?.apiBase ?? 'http://localhost:4000/api',
        user: session?.user ?? null,
      });
    });
    return true;
  }

  if (message.type === MSG.PROFILE_EXTRACTED) {
    chrome.storage.local.set({ lastProfile: message.profile, lastChannel: message.channelSlug });
    return false;
  }

  return false;
});
