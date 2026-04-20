"use client";

import Link from "next/link";
import { Title, Text, Table, Group, ThemeIcon, Badge } from "@mantine/core";
import { IconBuilding } from "@tabler/icons-react";
import type { Listing } from "@/types/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return (
    "R$\u00a0" +
    Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

function statusColor(status: Listing["status"]): string {
  switch (status) {
    case "active":
      return "green";
    case "inactive":
      return "yellow";
    case "removed":
      return "red";
    default:
      return "gray";
  }
}

function statusLabel(status: Listing["status"]): string {
  switch (status) {
    case "active":
      return "Ativo";
    case "inactive":
      return "Inativo";
    case "removed":
      return "Removido";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ListingsTableProps {
  listings: Listing[];
}

export function ListingsTable({ listings }: ListingsTableProps) {
  return (
    <>
      <Group mb="xs" gap="sm">
        <ThemeIcon size="lg" variant="light" color="blue">
          <IconBuilding size={20} />
        </ThemeIcon>
        <Title order={2}>Todos os Im&oacute;veis</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="xl">
        {listings.length === 0
          ? "Nenhum imóvel encontrado ainda. Execute o scraper para popular o banco de dados."
          : `${listings.length} imóvel${listings.length !== 1 ? "is" : ""} encontrado${listings.length !== 1 ? "s" : ""}.`}
      </Text>

      <Table.ScrollContainer minWidth={900}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>T&iacute;tulo</Table.Th>
              <Table.Th>Bairro</Table.Th>
              <Table.Th>Pre&ccedil;o</Table.Th>
              <Table.Th>Cond.</Table.Th>
              <Table.Th>&Aacute;rea</Table.Th>
              <Table.Th>Dorm.</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {listings.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text ta="center" c="dimmed" py="xl" size="sm">
                    Nenhum imóvel encontrado ainda. Execute o scraper para
                    popular o banco de dados.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              listings.map((listing) => (
                <Table.Tr key={listing.id}>
                  <Table.Td>
                    <Link
                      href={`/listing/${listing.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Text size="sm" lineClamp={1} title={listing.title}>
                        {listing.title || "—"}
                      </Text>
                    </Link>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{listing.neighborhood || "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {listing.price ? formatBRL(listing.price) : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {listing.condo_fee ? formatBRL(listing.condo_fee) : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {listing.area ? `${listing.area} m²` : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{listing.bedrooms ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={statusColor(listing.status)}
                      variant="light"
                      size="sm"
                    >
                      {statusLabel(listing.status)}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </>
  );
}
