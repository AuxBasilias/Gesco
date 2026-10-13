(function () {
  "use strict";

  function getInitials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase("fr"))
      .join("");
  }

  function renderProfile() {
    const api = window.AA;
    if (!api || typeof api.getProfile !== "function") return false;

    const profile = api.getProfile();
    if (!profile || !profile.name) return true;

    document.querySelectorAll("[data-user-name]").forEach((element) => {
      element.textContent = profile.name;
    });

    const headerName = document.querySelector("#userprofiledd .lh-14 span");
    if (headerName) {
      const role = document.createElement("small");
      role.className = "opacity-75";
      role.textContent = "Compte actif";
      headerName.replaceChildren(document.createTextNode(profile.name), document.createElement("br"), role);
    }

    const profileTitle = document.querySelector("#userprofiledd + .dropdown-menu h5");
    if (profileTitle) profileTitle.textContent = profile.name;

    const initials = getInitials(profile.name);
    document.querySelectorAll("#userprofiledd .avatar").forEach((avatar) => {
      avatar.textContent = initials;
    });

    return true;
  }

  window.renderUserProfile = renderProfile;

  function start() {
    if (renderProfile()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (renderProfile() || attempts > 50) clearInterval(timer);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();