/**
 * /listing/[id] — Listing detail page (server component).
 */

import { notFound } from "next/navigation";
import {
  Title,
  Text,
  Badge,
  Group,
  ThemeIcon,
  Grid,
  Paper,
  Stack,
  Anchor,
  Timeline,
  Divider,
} from "@mantine/core";
import {
  IconBuilding,
  IconMapPin,
  IconCurrencyReal,
  IconRuler,
  IconBed,
  IconBath,
  IconCar,
  IconLink,
  IconHistory,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  getListingById,
  getListingSources,
  getListingSnapshots,
} from "@/db/queries/listings";
import type { ListingSnapshot } from "@/types/index";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatPrice(value: number): string {
  // Brazilian format: R$ 850.000 (period as thousands separator, no decimals)
  return (
    "R$ " +
    value.toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
    })
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: "green", label: "Ativo" },
    inactive: { color: "gray", label: "Inativo" },
    removed: { color: "red", label: "Removido" },
  };
  const cfg = map[status] ?? { color: "gray", label: status };
  return (
    <Badge color={cfg.color} variant="filled" size="md">
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Snapshot timeline (only entries where price changed + first one)
// ---------------------------------------------------------------------------

function PriceTimeline({ snapshots }: { snapshots: ListingSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Sem histórico de preços registrado.
      </Text>
    );
  }

  // Keep only first snapshot + those where price changed vs previous
  const significant: ListingSnapshot[] = [];
  let lastPrice: number | null = null;

  for (const snap of snapshots) {
    if (lastPrice === null || snap.price !== lastPrice) {
      significant.push(snap);
      lastPrice = snap.price;
    }
  }

  return (
    <Timeline active={significant.length - 1} bulletSize={20} lineWidth={2}>
      {significant.map((snap, idx) => {
        const prev = idx > 0 ? significant[idx - 1] : null;
        const changed = prev !== null && snap.price !== prev.price;
        const increased = prev !== null && snap.price > prev.price;

        return (
          <Timeline.Item
            key={snap.id ?? idx}
            title={formatPrice(snap.price)}
            color={changed ? (increased ? "red" : "green") : "blue"}
          >
            <Text size="xs" c="dimmed">
              {formatDate(snap.captured_at)}
            </Text>
            {changed && prev && (
              <Text size="xs" c={increased ? "red" : "green"}>
                {increased ? "+" : ""}
                {formatPrice(snap.price - prev.price)}
              </Text>
            )}
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const listing = getListingById(id);
  if (!listing) notFound();

  const sources = getListingSources(id);
  const snapshots = getListingSnapshots(id);

  return (
    <>
      {/* Header */}
      <Group mb="xs" gap="sm" align="flex-start">
        <ThemeIcon size="lg" variant="light" color="blue">
          <IconBuilding size={20} />
        </ThemeIcon>
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="sm" align="center">
            <Title order={2}>{listing.title || "Imóvel sem título"}</Title>
            <StatusBadge status={listing.status} />
          </Group>
          <Group gap={4}>
            <IconMapPin size={14} />
            <Text size="sm" c="dimmed">
              {[listing.neighborhood, listing.city].filter(Boolean).join(", ")}
            </Text>
          </Group>
        </Stack>
      </Group>

      <Anchor component={Link} href="/all" size="sm" mb="xl" display="block">
        ← Voltar para todos os imóveis
      </Anchor>

      {/* Price + key metrics grid */}
      <Grid mb="xl" gutter="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb={4}>
              <IconCurrencyReal size={16} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Preço
              </Text>
            </Group>
            <Text size="xl" fw={700}>
              {formatPrice(listing.price)}
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
              Condomínio
            </Text>
            <Text fw={600}>
              {listing.condo_fee > 0 ? formatPrice(listing.condo_fee) : "—"}
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
              IPTU
            </Text>
            <Text fw={600}>
              {listing.iptu > 0 ? formatPrice(listing.iptu) : "—"}
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb={4}>
              <IconRuler size={14} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Área
              </Text>
            </Group>
            <Text fw={600}>{listing.area > 0 ? `${listing.area} m²` : "—"}</Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb={4}>
              <IconBed size={14} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Dormitórios
              </Text>
            </Group>
            <Text fw={600}>{listing.bedrooms}</Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb={4}>
              <IconBath size={14} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Suítes
              </Text>
            </Group>
            <Text fw={600}>{listing.suites}</Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
          <Paper withBorder p="md" radius="md">
            <Group gap={6} mb={4}>
              <IconCar size={14} />
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Vagas
              </Text>
            </Group>
            <Text fw={600}>{listing.parking}</Text>
          </Paper>
        </Grid.Col>

        {listing.neighborhood && (
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Paper withBorder p="md" radius="md">
              <Group gap={6} mb={4}>
                <IconMapPin size={14} />
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Bairro
                </Text>
              </Group>
              <Text fw={600}>{listing.neighborhood}</Text>
            </Paper>
          </Grid.Col>
        )}

        {listing.city && (
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Paper withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                Cidade
              </Text>
              <Text fw={600}>{listing.city}</Text>
            </Paper>
          </Grid.Col>
        )}
      </Grid>

      {/* Description */}
      {listing.description && (
        <>
          <Title order={4} mb="sm">
            Descrição
          </Title>
          <Paper withBorder p="md" radius="md" mb="xl">
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {listing.description}
            </Text>
          </Paper>
        </>
      )}

      <Divider mb="xl" />

      {/* Sources */}
      <Title order={4} mb="sm">
        <Group gap={6}>
          <IconLink size={18} />
          Fontes
        </Group>
      </Title>

      {sources.length === 0 ? (
        <Text c="dimmed" size="sm" mb="xl">
          Nenhuma fonte registrada.
        </Text>
      ) : (
        <Stack gap="xs" mb="xl">
          {sources.map((src) => (
            <Paper key={`${src.listing_id}-${src.source}`} withBorder p="sm" radius="md">
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Text size="sm" fw={600} tt="capitalize">
                    {src.source}
                  </Text>
                  <Text size="xs" c="dimmed">
                    ID externo: {src.external_id}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Visto pela 1ª vez: {formatDate(src.first_seen_at)} · Última vez: {formatDate(src.last_seen_at)}
                  </Text>
                </Stack>
                {src.url && (
                  <Anchor href={src.url} target="_blank" rel="noopener noreferrer" size="sm">
                    Ver anúncio →
                  </Anchor>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider mb="xl" />

      {/* Price history */}
      <Title order={4} mb="sm">
        <Group gap={6}>
          <IconHistory size={18} />
          Histórico de Preços
        </Group>
      </Title>

      <PriceTimeline snapshots={snapshots} />
    </>
  );
}
