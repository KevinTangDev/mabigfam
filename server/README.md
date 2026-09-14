# server

API backend goes here (Fastify or Express + TypeScript), using the Prisma
client generated from `../prisma/schema.prisma`.

Suggested first task for Claude Code:
- Scaffold the project (`package.json`, `tsconfig.json`, Prisma setup).
- CRUD routes for `FamilyMember` (create, list, get by id, update, delete).
- Routes to add/remove `ParentChild` links.
- A route that returns a member with their parents and children resolved,
  for the tree view.
