"use client";

import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Divider,
  Anchor,
  SimpleGrid,
} from "@mantine/core";
import {
  IconRuler,
  IconBed,
  IconBath,
  IconCar,
  IconMapPin,
} from "@tabler/icons-react";
import type { Listing } from "@/types";

interface ListingCardProps {
  listing: Listing;
  isNew?: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function ListingCard({ listing, isNew = false }: ListingCardProps) {
  const totalMonthly = listing.condo_fee + listing.iptu;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      {/* Title row */}
      <Group justify="space-between" mb="xs" wrap="nowrap" align="flex-start">
        <Text fw={600} size="md" lineClamp={2} style={{ flex: 1 }}>
          {listing.title}
        </Text>
        {isNew && (
          <Badge color="green" variant="filled" size="sm" ml="xs">
            NOVO
          </Badge>
        )}
      </Group>

      {/* Location */}
      <Group gap={4} mb="sm">
        <IconMapPin size={14} />
        <Text size="sm" c="dimmed">
          {listing.neighborhood}
          {listing.city ? `, ${listing.city}` : ""}
        </Text>
      </Group>

      <Divider mb="sm" />

      {/* Price */}
      <Stack gap={2} mb="sm">
        <Text size="xl" fw={700}>
          {formatCurrency(listing.price)}
        </Text>
        {totalMonthly > 0 && (
          <Text size="xs" c="dimmed">
            + {formatCurrency(totalMonthly)}/mês (condomínio + IPTU)
          </Text>
        )}
      </Stack>

      {/* Attributes */}
      <SimpleGrid cols={4} spacing="xs">
        <Group gap={4}>
          <IconRuler size={16} />
          <Text size="sm">{listing.area} m²</Text>
        </Group>
        <Group gap={4}>
          <IconBed size={16} />
          <Text size="sm">{listing.bedrooms} dorm.</Text>
        </Group>
        <Group gap={4}>
          <IconBath size={16} />
          <Text size="sm">{listing.suites} suíte{listing.suites !== 1 ? "s" : ""}</Text>
        </Group>
        <Group gap={4}>
          <IconCar size={16} />
          <Text size="sm">{listing.parking} vaga{listing.parking !== 1 ? "s" : ""}</Text>
        </Group>
      </SimpleGrid>

      {listing.pets_allowed !== null && listing.pets_allowed !== undefined && (
        <Badge
          mt="sm"
          color={listing.pets_allowed ? "teal" : "gray"}
          variant="light"
          size="sm"
        >
          {listing.pets_allowed ? "Aceita pets" : "Não aceita pets"}
        </Badge>
      )}

      {/* Detail link */}
      <Anchor
        component="a"
        href={`/listing/${listing.id}`}
        size="sm"
        mt="md"
        display="block"
      >
        Ver detalhes →
      </Anchor>
    </Card>
  );
}
