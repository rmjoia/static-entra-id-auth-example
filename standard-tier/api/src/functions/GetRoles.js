const { app } = require("@azure/functions");

// Called by Azure SWA on every sign-in once `auth.rolesSource` is set to "/api/GetRoles"
// in staticwebapp.config.json. The platform POSTs the user's claims; we return the SWA
// roles to assign for this session. The built-in invitations system is ignored once
// rolesSource is configured.
//
// Expected request body (from SWA):
//   {
//     "identityProvider": "aad",
//     "userId": "...",
//     "userDetails": "user@example.com",
//     "claims": [
//       { "typ": "groups", "val": "<entra-group-object-id>" },
//       { "typ": "groups", "val": "<another-group-object-id>" },
//       ...
//     ],
//     "accessToken": "..."
//   }
//
// We return:
//   { "roles": ["boardmember", ...] }
//
// The group object IDs come from the optional `groups` claim, which must be added to
// the Entra app registration (App registrations -> Token configuration -> Add optional
// claim -> ID token -> groups).
//
// Note on the "groups overage" scenario: if a user is in more than ~150 groups, Entra
// omits the groups array from the token and instead includes a _claim_names / _claim_sources
// pair pointing to Microsoft Graph. Handling that requires a Graph call with the
// accessToken. This sample does not implement that fallback -- if your users are in
// large numbers of groups, see the assign-roles-microsoft-graph tutorial.

app.http("GetRoles", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 200, jsonBody: { roles: [] } };
    }

    const claims = Array.isArray(body && body.claims) ? body.claims : [];
    const groupIds = new Set(
      claims.filter(c => c && c.typ === "groups").map(c => c.val)
    );

    const boardGroupId = process.env.BOARD_GROUP_ID;
    const roles = [];

    if (boardGroupId && groupIds.has(boardGroupId)) {
      roles.push("boardmember");
    }

    context.log(
      `GetRoles: user=${body.userDetails} provider=${body.identityProvider} ` +
      `groupCount=${groupIds.size} assigned=${JSON.stringify(roles)}`
    );

    return { status: 200, jsonBody: { roles } };
  }
});
