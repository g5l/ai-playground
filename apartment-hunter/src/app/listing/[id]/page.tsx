"use client";

import { Title, Text, Group, ThemeIcon, Alert } from "@mantine/core";
import { IconBuilding, IconInfoCircle } from "@tabler/icons-react";
import { useParams } from "next/navigation";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <>
      <Group mb="xs" gap="sm">
        <ThemeIcon size="lg" variant="light" color="blue">
          <IconBuilding size={20} />
        </ThemeIcon>
        <Title order={2}>Detalhe do Imóvel</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="xl">
        ID: <code>{params.id}</code>
      </Text>

      <Alert
        icon={<IconInfoCircle size={16} />}
        title="Em construção"
        color="blue"
      >
        Página de detalhes do imóvel será implementada na Fase 2. Aqui serão
        exibidos todos os dados do imóvel, histórico de preços, ranking e
        link para o anúncio original.
      </Alert>
    </>
  );
}
