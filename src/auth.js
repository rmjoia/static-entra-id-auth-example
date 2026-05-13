// Reads the current user from Azure Static Web Apps' built-in /.auth/me endpoint
// and renders a small Sign in / Sign out control in the header.
//
// /.auth/me returns: { clientPrincipal: null }  when anonymous
//                    { clientPrincipal: { userId, userDetails, identityProvider, userRoles } }
//                    when signed in.

(async function renderUserArea() {
  const mount = document.getElementById("user-area");
  if (!mount) return;

  // Where to return to after auth completes (this page).
  const here = encodeURIComponent(window.location.pathname + window.location.search);

  try {
    const res = await fetch("/.auth/me", { credentials: "include" });
    const data = await res.json();
    const principal = data && data.clientPrincipal;

    if (principal) {
      const name = principal.userDetails || "Signed in";
      mount.innerHTML = `
        <span title="${principal.identityProvider}">Signed in as <strong>${escapeHtml(name)}</strong></span>
        <a href="/.auth/logout?post_logout_redirect_uri=${here}">Sign out</a>
      `;
    } else {
      mount.innerHTML = `
        <a href="/.auth/login/aad?post_login_redirect_uri=${here}">Sign in</a>
      `;
    }
  } catch (err) {
    // If /.auth/me isn't reachable (e.g. running locally without the SWA CLI),
    // just show a sign-in link so the page still works.
    mount.innerHTML = `<a href="/.auth/login/aad?post_login_redirect_uri=${here}">Sign in</a>`;
  }
})();

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
