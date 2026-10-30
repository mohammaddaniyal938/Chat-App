const socket = io();

const nameModal = document.getElementById("nameModal");
const nameForm = document.getElementById("nameForm");
const usernameInput = document.getElementById("usernameInput");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");
const emptyState = document.getElementById("emptyState");
const onlineCount = document.getElementById("onlineCount");

let username = "";

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  username = usernameInput.value.trim().slice(0, 20);
  if (!username) return;

  socket.emit("join", username);
  nameModal.hidden = true;
  messageInput.disabled = false;
  sendButton.disabled = false;
  messageInput.focus();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit("chat message", message);
  messageInput.value = "";
  messageInput.focus();
});

socket.on("chat message", (data) => {
  emptyState?.remove();

  const item = document.createElement("article");
  item.className = `message${data.senderId === socket.id ? " own" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = data.username.charAt(0).toUpperCase();

  const content = document.createElement("div");
  content.className = "message-content";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = data.senderId === socket.id ? `${data.username} (You)` : data.username;

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = data.time;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = data.message;

  meta.append(name, time);
  content.append(meta, bubble);
  item.append(avatar, content);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

socket.on("system message", (message) => {
  emptyState?.remove();
  const note = document.createElement("div");
  note.className = "system-message";
  note.textContent = message;
  messages.appendChild(note);
  messages.scrollTop = messages.scrollHeight;
});

socket.on("online count", (count) => {
  onlineCount.textContent = count;
});

socket.on("connect", () => {
  if (username) socket.emit("join", username);
});

socket.on("disconnect", () => {
  messageInput.disabled = true;
  sendButton.disabled = true;
});

socket.on("connect", () => {
  if (username) {
    messageInput.disabled = false;
    sendButton.disabled = false;
  }
});