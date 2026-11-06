// Compatibility loader for the old root static entrypoint.
// The application UI lives in frontend/app.js; this file is never a server entrypoint.
if (typeof document !== "undefined") {
  const script = document.createElement("script");
  script.src = "/frontend/app.js";
  script.defer = true;
  document.head.appendChild(script);
}
