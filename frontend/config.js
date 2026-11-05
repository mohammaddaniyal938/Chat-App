const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
window.CHAT_API_URL = window.CHAT_API_URL || (isLocal ? "http://localhost:3000" : window.location.origin);
window.CHAT_SOCKET_URL = window.CHAT_SOCKET_URL || window.CHAT_API_URL;
