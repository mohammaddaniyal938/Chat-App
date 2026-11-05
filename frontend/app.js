const $ = (selector) => document.querySelector(selector);
const authModal = $("#nameModal");
const authForm = $("#nameForm");
const authTitle = $("#authTitle");
const authCopy = $("#authCopy");
const usernameInput = $("#usernameInput");
const emailInput = $("#emailInput");
const passwordInput = $("#passwordInput");
const authSwitch = $("#authSwitch");
const authError = $("#authError");
const messageForm = $("#messageForm");
const messageInput = $("#messageInput");
const sendButton = $("#sendButton");
const messages = $("#messages");
const emptyState = $("#emptyState");
const onlineCount = $("#onlineCount");
const registeredCount = $("#registeredCount");
const onlineUsersCount = $("#onlineUsersCount");
const offlineUsersCount = $("#offlineUsersCount");
const userList = $("#userList");
const chatList = $(".chat-list");
const searchInput = $("#searchInput");
const profileModal = $("#profileModal");
const roomModal = $("#roomModal");
const groupModal = $("#groupModal");
const userMenuModal = $("#userMenuModal");
const userMenuError = $("#userMenuError");
const userLogoutButton = $("#userLogoutButton");
const userRemoveButton = $("#userRemoveButton");
const profileDetails = $("#profileDetails");
const profileForm = $("#profileForm");
const profileAvatarInput = $("#profileAvatarInput");
const API_BASE_URL = window.CHAT_API_URL.replace(/\/$/, "");
const SOCKET_BASE_URL = window.CHAT_SOCKET_URL.replace(/\/$/, "");
const apiUrl = (url) => `${API_BASE_URL}${url}`;

// Authentication is intentionally tab-scoped: tabs must not share login state.
localStorage.removeItem("chatToken");
let token = sessionStorage.getItem("chatToken");
let user = null;
let currentRoom = { id: "general", name: "General Chat", description: "Say hello to everyone in the room.", public: true };
let socket;
let signUpMode = false;
let renderedMessageIds = new Set();
let loadingMessages = false;
let loadingMessagesForRoom = null;
let pendingMessages = [];
let selectedUser = null;
let roomSelectionVersion = 0;
let messageLoadVersion = 0;

const api = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(apiUrl(url), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
    });
  } catch (error) {
    throw new Error(`Cannot connect to the chat server at ${API_BASE_URL}. Start the backend and verify MongoDB is running.`);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    clearSession();
    showLogin();
  }
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
};
const clearSession = () => {
  token = null;
  user = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  sessionStorage.removeItem("chatToken");
  setReady(false);
};
const showLogin = () => {
  authModal.hidden = false;
  profileModal.hidden = true;
  roomModal.hidden = true;
  groupModal.hidden = true;
  userMenuModal.hidden = true;
  authError.hidden = true;
  emailInput.focus();
};
const closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.hidden = true;
};
const logoutCurrentUser = async () => {
  let logoutError;
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (error) {
    logoutError = error;
  } finally {
    clearSession();
    showLogin();
  }
  if (logoutError) throw logoutError;
};
const showError = (error, target = authError) => { target.textContent = error.message || error; target.hidden = false; };
const setReady = (ready) => { messageInput.disabled = !ready; sendButton.disabled = !ready; };
const renderMessage = (data) => {
  if (!data || !data.username || !user) return;
  if (data.id && renderedMessageIds.has(data.id)) return;
  if (data.id) renderedMessageIds.add(data.id);
  emptyState?.remove();
  const item = document.createElement("article");
  const isOwnMessage = String(data.senderId) === String(user.id);
  item.className = `message${isOwnMessage ? " own" : " received"}`;
  item.innerHTML = `<div class="avatar"></div><div class="message-content"><div class="message-meta"><span class="message-name"></span><span class="message-time"></span></div><div class="bubble"></div></div>`;
  item.querySelector(".avatar").textContent = data.username[0].toUpperCase();
  item.querySelector(".message-name").textContent = isOwnMessage ? `${data.username} (You)` : data.username;
  item.querySelector(".message-time").textContent = data.time;
  item.querySelector(".bubble").textContent = data.message;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
};
const updatePresence = (presence) => {
  if (!presence || !Array.isArray(presence.users)) return;
  registeredCount.textContent = presence.registered;
  onlineUsersCount.textContent = presence.online;
  offlineUsersCount.textContent = presence.offline;
  onlineCount.textContent = presence.online;
  userList.innerHTML = "";
  presence.users.forEach((presenceUser) => {
    const item = document.createElement("li");
    item.className = "user-row";
    item.innerHTML = `<span class="user-avatar"></span><span class="user-name"></span><span class="user-status"><span class="presence-indicator"></span><span class="user-status-label"></span></span><button class="user-menu-button" type="button" aria-label="Actions for user"><span aria-hidden="true">⋮</span></button>`;
    item.querySelector(".user-avatar").textContent = presenceUser.username.charAt(0).toUpperCase();
    if (presenceUser.avatar) item.querySelector(".user-avatar").style.backgroundImage = `url("${presenceUser.avatar}")`;
    item.querySelector(".user-name").textContent = presenceUser.id === user?.id ? `${presenceUser.username} (You)` : presenceUser.username;
    item.querySelector(".user-status").classList.toggle("is-online", presenceUser.online);
    item.querySelector(".user-status-label").textContent = presenceUser.online ? "Online" : "Offline";
    item.querySelector(".user-menu-button").addEventListener("click", (event) => {
      event.stopPropagation();
      selectedUser = presenceUser;
      $("#userMenuTitle").textContent = `${presenceUser.username} actions`;
      $("#userMenuCopy").textContent = presenceUser.id === user?.id ? "Manage your current session." : `Manage ${presenceUser.username}'s session.`;
      userMenuError.hidden = true;
      userMenuModal.hidden = false;
    });
    item.addEventListener("click", () => {
      if (presenceUser.id !== user?.id) openPrivateConversation(presenceUser.id).catch(showError);
    });
    userList.appendChild(item);
  });
};
const clearConversation = () => {
  messages.querySelectorAll(".message,.system-message").forEach((item) => item.remove());
  if (!messages.contains(emptyState)) messages.appendChild(emptyState);
  renderedMessageIds = new Set();
  pendingMessages = [];
};
const loadMessages = async (room = currentRoom) => {
  const roomId = room.id;
  const loadVersion = ++messageLoadVersion;
  loadingMessages = true;
  loadingMessagesForRoom = roomId;
  clearConversation();
  emptyState.remove();
  try {
    const { messages: history } = await api(`/api/rooms/${roomId}/messages`);
    if (currentRoom.id !== roomId || loadVersion !== messageLoadVersion) return;
    history
      .map((message, index) => ({ message, index }))
      .sort((left, right) => {
        if (!left.message.createdAt || !right.message.createdAt) return left.index - right.index;
        return left.message.createdAt.localeCompare(right.message.createdAt);
      })
      .forEach(({ message }) => renderMessage(message));
    pendingMessages.forEach(renderMessage);
    if (!history.length && !pendingMessages.length) messages.appendChild(emptyState);
  } finally {
    if (loadingMessagesForRoom === roomId) {
      loadingMessages = false;
      loadingMessagesForRoom = null;
      pendingMessages = [];
    }
  }
};
const loadRooms = async (search = "") => {
  const { rooms } = await api(`/api/rooms${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  chatList.innerHTML = "";
  rooms.forEach((room) => {
    const item = document.createElement("li");
    item.className = `chat-item${room.id === currentRoom.id ? " active" : ""}`;
    item.dataset.roomId = room.id;
    item.innerHTML = `<div class="chat-avatar">${room.name[0].toUpperCase()}</div><div class="chat-item-body"><div class="chat-item-top"><span class="chat-item-name"></span><span class="room-tag">${room.public ? "PUBLIC ROOM" : room.type === "group" ? "GROUP" : "CHAT"}</span></div><div class="chat-item-preview"></div></div>`;
    item.querySelector(".chat-item-name").textContent = room.name;
    item.querySelector(".chat-item-preview").textContent = room.description;
    item.addEventListener("click", () => selectRoom(room).catch(showError));
    chatList.appendChild(item);
  });
  return rooms;
};
const openPrivateConversation = async (userId) => {
  const { room } = await api("/api/conversations", { method: "POST", body: JSON.stringify({ userId }) });
  await selectRoom(room);
};
const selectRoom = async (room) => {
  const selectionVersion = ++roomSelectionVersion;
  currentRoom = room;
  clearConversation();
  $("#roomTitle").textContent = room.name;
  $("#roomDescription").textContent = room.description;
  if (!socket?.connected) throw new Error("Chat connection is unavailable. Please try again.");
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("The chat did not respond. Please try again.")), 5000);
    socket.emit("join room", room.id, (result) => {
      clearTimeout(timeout);
      if (result?.error) reject(new Error(result.error));
      else resolve(result);
    });
  });
  if (selectionVersion !== roomSelectionVersion) {
    if (currentRoom.id !== room.id) socket.emit("join room", currentRoom.id);
    return;
  }
  await loadRooms(searchInput.value);
  await loadMessages(room);
};
const connectSocket = () => new Promise((resolve, reject) => {
  socket = io(SOCKET_BASE_URL, { auth: { token }, autoConnect: false });
  const onConnect = () => { cleanup(); resolve(); };
  const onError = () => {
    cleanup();
    socket.close();
    reject(new Error("Chat connection failed. Make sure the backend is running on port 3000."));
  };
  const cleanup = () => {
    socket.off("connect", onConnect);
    socket.off("connect_error", onError);
  };
  socket.once("connect", onConnect);
  socket.once("connect_error", onError);
  socket.connect();
});
const connect = async () => {
  if (!token) {
    showLogin();
    return;
  }
  const result = await api("/api/me");
  user = result.user;
  $("#profileName").textContent = user.username;
  $("#profileBio").textContent = user.bio || "Available";
  updateProfileDetails(user);
  setReady(false);
  await connectSocket();
  authModal.hidden = true;
  setReady(true);
  socket.on("connect_error", (error) => { setReady(false); showError(error); });
  socket.on("disconnect", () => setReady(false));
  socket.on("chat message", (data) => {
    if (data.roomId !== currentRoom.id) return;
    if (loadingMessages && loadingMessagesForRoom === currentRoom.id) pendingMessages.push(data);
    else renderMessage(data);
  });
  socket.on("presence update", updatePresence);
  socket.on("rooms update", () => loadRooms(searchInput.value).catch(showError));
  updatePresence(await api("/api/stats"));
  const rooms = await loadRooms();
  const general = rooms.find((room) => room.type === "public");
  if (general) await selectRoom(general);
  else await loadMessages();
  messageInput.focus();
};

authSwitch.addEventListener("click", () => {
  signUpMode = !signUpMode;
  authTitle.textContent = signUpMode ? "Create your account" : "Welcome to Socket Chat";
  authCopy.textContent = signUpMode ? "Sign up to start chatting with your team." : "Sign in to join the conversation.";
  usernameInput.hidden = !signUpMode;
  usernameInput.required = signUpMode;
  $("#usernameLabel").hidden = !signUpMode;
  authSwitch.textContent = signUpMode ? "Already have an account? Sign in" : "New here? Create an account";
  authError.hidden = true;
});
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.hidden = true;
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !/^[^\s@]+@gmail\.com$/i.test(email)) {
    return showError(new Error("Enter a valid Gmail address."));
  }
  if (!password || password.length < 6) {
    return showError(new Error("Password must be at least 6 characters."));
  }
  try {
    const data = await api(`/api/auth/${signUpMode ? "signup" : "login"}`, { method: "POST", body: JSON.stringify({ username: usernameInput.value, email, password }) });
    token = data.token;
    sessionStorage.setItem("chatToken", token);
    await connect();
  } catch (error) {
    token = null;
    sessionStorage.removeItem("chatToken");
    setReady(false);
    authModal.hidden = false;
    showError(error);
  }
});
messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  if (!socket?.connected) return showError(new Error("Chat connection is unavailable. Please try again."));
  socket.emit("chat message", { roomId: currentRoom.id, message: text }, (result) => {
    if (result?.error) return showError(new Error(result.error));
    messageInput.value = "";
  });
});
searchInput.addEventListener("input", () => loadRooms(searchInput.value).catch(showError));
const openRoomModal = () => { roomModal.hidden = false; $("#roomNameInput").focus(); };
const updateProfileDetails = (profile) => {
  $("#profileDetailsName").textContent = profile.username;
  $("#profileDetailsEmail").textContent = profile.email;
  $("#profileDetailsBio").textContent = profile.bio || "Available";
  $("#profileAvatar").textContent = profile.username.charAt(0).toUpperCase();
  $("#profileAvatar").style.backgroundImage = profile.avatar ? `url("${profile.avatar}")` : "";
};
const openProfile = () => {
  if (!user) return showLogin();
  updateProfileDetails(user);
  profileDetails.hidden = false;
  profileForm.hidden = true;
  profileModal.hidden = false;
};
const openProfileEdit = () => {
  profileDetails.hidden = true;
  profileForm.hidden = false;
  $("#profileUsername").value = user.username;
  $("#profileBioInput").value = user.bio || "";
  $("#profileError").hidden = true;
};
const openGroupModal = async () => {
  if (!user) return showLogin();
  const { users } = await api("/api/users");
  const groupMembers = $("#groupMembers");
  groupMembers.innerHTML = "";
  users.forEach((item) => {
    const label = document.createElement("label");
    label.className = "group-member-option";
    const isCurrentUser = item.id === user.id;
    label.innerHTML = `<input type="checkbox" value="${item.id}"${isCurrentUser ? " checked disabled" : ""}><span class="user-avatar">${item.username.charAt(0).toUpperCase()}</span><span></span>`;
    label.querySelector("span:last-child").textContent = item.username;
    groupMembers.appendChild(label);
  });
  $("#groupError").hidden = true;
  groupModal.hidden = false;
};
const openRoomModalIfAuthenticated = () => {
  if (!user) return showLogin();
  openRoomModal();
};
$("#newChatButton").addEventListener("click", openRoomModalIfAuthenticated);
$("#addGroupButton").addEventListener("click", () => openGroupModal().catch((error) => showError(error)));
$("#settingsButton").addEventListener("click", () => {
  if (!user) return showLogin();
  $("#profileUsername").value = user.username;
  $("#profileBioInput").value = user.bio || "";
  openProfileEdit();
  profileModal.hidden = false;
});
$("#roomForm").addEventListener("submit", async (event) => { event.preventDefault(); $("#roomError").hidden = true; try { const { room } = await api("/api/rooms", { method: "POST", body: JSON.stringify({ name: $("#roomNameInput").value }) }); roomModal.hidden = true; $("#roomNameInput").value = ""; await selectRoom(room); } catch (error) { showError(error, $("#roomError")); } });
$("#groupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#groupError").hidden = true;
  try {
    const memberIds = [...document.querySelectorAll("#groupMembers input:checked")].map((input) => input.value);
    const { room } = await api("/api/groups", { method: "POST", body: JSON.stringify({ name: $("#groupNameInput").value, memberIds }) });
    groupModal.hidden = true;
    $("#groupNameInput").value = "";
    await selectRoom(room);
  } catch (error) {
    showError(error, $("#groupError"));
  }
});
$("#profileTrigger").addEventListener("click", openProfile);
$("#profileTrigger").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openProfile();
  }
});
$("#editProfileButton").addEventListener("click", openProfileEdit);
$("#cancelProfileEdit").addEventListener("click", () => { profileForm.hidden = true; profileDetails.hidden = false; });
profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#profileError").hidden = true;
  try {
    let avatar = user.avatar || "";
    if (profileAvatarInput.files[0]) {
      avatar = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("The profile picture could not be read."));
        reader.readAsDataURL(profileAvatarInput.files[0]);
      });
    }
    const result = await api("/api/me", { method: "PATCH", body: JSON.stringify({ username: $("#profileUsername").value, bio: $("#profileBioInput").value, avatar }) });
    user = result.user;
    $("#profileName").textContent = user.username;
    $("#profileBio").textContent = user.bio || "Available";
    updateProfileDetails(user);
    profileForm.hidden = true;
    profileDetails.hidden = false;
    profileAvatarInput.value = "";
  } catch (error) { showError(error, $("#profileError")); }
});
$("#logoutButton").addEventListener("click", async () => {
  $("#logoutButton").disabled = true;
  try {
    await logoutCurrentUser();
  } catch (error) {
    showError(error, authError);
  } finally {
    $("#logoutButton").disabled = false;
  }
});
userLogoutButton.addEventListener("click", async () => {
  if (!selectedUser) return;
  userMenuError.hidden = true;
  try {
    await api(`/api/users/${selectedUser.id}/logout`, { method: "POST" });
    userMenuModal.hidden = true;
    if (selectedUser.id === user?.id) {
      clearSession();
      showLogin();
    }
  } catch (error) {
    showError(error, userMenuError);
  }
});
userRemoveButton.addEventListener("click", async () => {
  if (!selectedUser || !window.confirm(`Remove ${selectedUser.username} from the users list? This removes their account.`)) return;
  userMenuError.hidden = true;
  try {
    await api(`/api/users/${selectedUser.id}`, { method: "DELETE" });
    userMenuModal.hidden = true;
    if (selectedUser.id === user?.id) {
      clearSession();
      showLogin();
    }
  } catch (error) {
    showError(error, userMenuError);
  }
});
document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-modal]");
  if (!closeButton) return;
  event.preventDefault();
  event.stopPropagation();
  closeModal(closeButton.dataset.closeModal);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".modal-backdrop:not([hidden])").forEach((modal) => { modal.hidden = true; });
});
document.querySelectorAll(".composer-tools .icon-btn").forEach((button) => button.addEventListener("click", () => { messageInput.value += " 🙂"; messageInput.focus(); }));

usernameInput.required = false;
$("#usernameLabel").hidden = true;
connect().catch((error) => {
  if (token) {
    clearSession();
    showLogin();
    showError(error);
  }
});
