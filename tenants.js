// Known LiftMe operators, kept in sync with LiftMe.Api/appsettings.json's Tenants list.
// Add a row here every time a new operator goes live so the "find my company" search
// on the marketing site can point parents at the right subdomain.
const LIFTME_TENANTS = [
  { name: "LiftMe HQ", slug: "hq" },
  { name: "Client One Transport", slug: "client1" },
];
