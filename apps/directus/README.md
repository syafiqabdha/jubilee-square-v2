# 🏛️ Directus 11 Headless CMS Integration — Jubilee Square v2

This package manages the headless Directus 11 CMS infrastructure, schemas, relationships, role-based access control, and GraphQL/REST queries for **Jubilee Square v2**.

---

## 1. Schema Architecture & Collections

The Directus instance models the mall's 23 tenants across 5 core verticals with rich metadata:

| Collection | Icon | Type | Description |
| :--- | :--- | :--- | :--- |
| `categories` | `category` | Vertical | Dine, Learn, Relax, Shop, Services with colors & icons |
| `tenants` | `storefront` | Core Catalog | 23 verified stores with unit #, floor levels, phone, and metadata |
| `operating_hours` | `schedule` | O2M (Tenant) | Daily opening/closing hours per tenant |
| `promotions` | `local_offer` | O2M (Tenant) | Active discounts, lunch specials, trial vouchers |
| `amenities` | `room_service` | M2M (Tenant) | Wheelchair, Halal, Wi-Fi, Child-friendly, Contactless Pay |
| `signage_slides` | `tv` | Digital Signage | Playlists & rotating slides for 7 displays across Levels 1–4 |

---

## 2. Directus REST Endpoints

Directus automatically exposes standard REST endpoints mapped to the Postgres schema:

* `GET /items/categories?fields=*,tenants.*`
* `GET /items/tenants?filter[slug][_eq]=my-drum-school&fields=*,operating_hours.*,promotions.*`
* `GET /items/signage_slides?filter[is_active][_eq]=true&sort=priority`

---

## 3. Directus GraphQL API

Directus exposes a full GraphQL endpoint at `/graphql`. See [`queries.graphql`](./queries.graphql) for sample production queries.

```graphql
query GetStoreDirectory {
  tenants(filter: { is_active: { _eq: true } }, sort: ["floor_level", "unit_number"]) {
    name
    slug
    floor_level
    unit_number
    category_id {
      name
      slug
    }
  }
}
```

---

## 4. Bootstrapping & Deployment

Apply the schema snapshot to any fresh or running Directus 11 instance:

```bash
# Automated TypeScript bootstrap
npm run bootstrap --workspace=apps/directus

# Directus CLI native schema apply
npx directus schema apply ./schema.snapshot.json --yes
```
