/**
 * /all — Server component: fetches listings from DB and renders the table.
 */

import { getAllListings } from "@/db/queries/listings";
import { ListingsTable } from "./ListingsTable";

export default function AllListingsPage() {
  const listings = getAllListings({ limit: 500 });
  return <ListingsTable listings={listings} />;
}
