"use client";

import {
  Title,
  Text,
  Group,
  ThemeIcon,
  Stack,
  NumberInput,
  Switch,
  TagsInput,
  MultiSelect,
  Button,
  TextInput,
  Card,
  Divider,
  SimpleGrid,
  Alert,
  LoadingOverlay,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconSettings, IconDeviceFloppy, IconCheck, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { PORTO_ALEGRE_NEIGHBORHOODS } from "@/lib/neighborhoods";
import type { FilterCriteria, FilterProfile } from "@/types";

// Default values when no profile exists yet
const DEFAULT_CRITERIA: FilterCriteria = {
  priceMin: 300_000,
  priceMax: 900_000,
  condoFeeMax: 1_500,
  iptuMax: 500,
  totalMonthlyMax: 10_000,
  areaMin: 60,
  bedroomsMin: 2,
  suitesMin: 1,
  parkingMin: 1,
  neighborhoods: [],
  petsAllowed: false,
  excludeKeywords: [],
};

interface FormValues extends FilterCriteria {
  name: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      name: "Meu Perfil",
      ...DEFAULT_CRITERIA,
    },
    validate: {
      priceMin: (v) =>
        v < 0 ? "Preço mínimo deve ser positivo" : null,
      priceMax: (v, values) =>
        v < values.priceMin ? "Preço máximo deve ser maior que o mínimo" : null,
      areaMin: (v) => (v < 0 ? "Área mínima deve ser positiva" : null),
    },
  });

  // Load active profile on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error("Falha ao carregar perfil");
        const data: FilterProfile = await res.json();
        form.setValues({
          name: data.name,
          ...data.filters,
        });
      } catch (err) {
        notifications.show({
          title: "Erro ao carregar perfil",
          message: String(err),
          color: "red",
          icon: <IconX size={16} />,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const { name, ...filters } = values;
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Falha ao salvar perfil");
      }
      notifications.show({
        title: "Perfil salvo!",
        message: "Suas preferências foram atualizadas com sucesso.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: "Erro ao salvar",
        message: String(err),
        color: "red",
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const neighborhoodOptions = PORTO_ALEGRE_NEIGHBORHOODS.map((n) => ({
    value: n,
    label: n,
  }));

  return (
    <>
      <Group mb="xs" gap="sm">
        <ThemeIcon size="lg" variant="light" color="orange">
          <IconSettings size={20} />
        </ThemeIcon>
        <Title order={2}>Perfil de Busca</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="xl">
        Configure seus critérios de busca. O sistema usará essas preferências
        para filtrar e rankear os imóveis encontrados.
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="xl" pos="relative">
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

          {/* ---------------------------------------------------------------- */}
          {/* Profile name */}
          {/* ---------------------------------------------------------------- */}
          <Card withBorder padding="lg">
            <Title order={4} mb="md">
              Nome do Perfil
            </Title>
            <TextInput
              label="Nome"
              placeholder="Meu Perfil"
              {...form.getInputProps("name")}
              maw={400}
            />
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Price */}
          {/* ---------------------------------------------------------------- */}
          <Card withBorder padding="lg">
            <Title order={4} mb="md">
              Preço de Venda
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <NumberInput
                label="Preço mínimo (R$)"
                placeholder="300000"
                min={0}
                step={10_000}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...form.getInputProps("priceMin")}
              />
              <NumberInput
                label="Preço máximo (R$)"
                placeholder="900000"
                min={0}
                step={10_000}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...form.getInputProps("priceMax")}
              />
            </SimpleGrid>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Monthly costs */}
          {/* ---------------------------------------------------------------- */}
          <Card withBorder padding="lg">
            <Title order={4} mb="md">
              Custos Mensais
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <NumberInput
                label="Condomínio máximo (R$/mês)"
                placeholder="1500"
                min={0}
                step={100}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...form.getInputProps("condoFeeMax")}
              />
              <NumberInput
                label="IPTU máximo (R$/mês)"
                placeholder="500"
                min={0}
                step={50}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...form.getInputProps("iptuMax")}
              />
              <NumberInput
                label="Total mensal máximo (R$/mês)"
                description="Condomínio + IPTU + outros"
                placeholder="10000"
                min={0}
                step={500}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                {...form.getInputProps("totalMonthlyMax")}
              />
            </SimpleGrid>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Property characteristics */}
          {/* ---------------------------------------------------------------- */}
          <Card withBorder padding="lg">
            <Title order={4} mb="md">
              Características do Imóvel
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
              <NumberInput
                label="Área mínima (m²)"
                placeholder="60"
                min={0}
                step={5}
                suffix=" m²"
                {...form.getInputProps("areaMin")}
              />
              <NumberInput
                label="Dormitórios mínimos"
                placeholder="2"
                min={0}
                max={10}
                step={1}
                {...form.getInputProps("bedroomsMin")}
              />
              <NumberInput
                label="Suítes mínimas"
                placeholder="1"
                min={0}
                max={10}
                step={1}
                {...form.getInputProps("suitesMin")}
              />
              <NumberInput
                label="Vagas mínimas"
                placeholder="1"
                min={0}
                max={10}
                step={1}
                {...form.getInputProps("parkingMin")}
              />
            </SimpleGrid>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Neighborhoods */}
          {/* ---------------------------------------------------------------- */}
          <Card withBorder padding="lg">
            <Title order={4} mb="md">
              Bairros de Interesse
            </Title>
            <Text size="sm" c="dimmed" mb="sm">
              Deixe vazio para aceitar qualquer bairro de Porto Alegre.
            </Text>
            <MultiSelect
              label="Bairros"
              placeholder="Selecione os bairros desejados..."
              data={neighborhoodOptions}
              searchable
              clearable
              maxDropdownHeight={300}
              {...form.getInputProps("neighborhoods")}
            />
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Pets & keywords */}
          {/* ---------------------------------------------------------------- */}
          <Card withBorder padding="lg">
            <Title order={4} mb="md">
              Preferências Adicionais
            </Title>
            <Stack gap="md">
              <Switch
                label="Aceita animais de estimação"
                description="Filtrar apenas imóveis que aceitam pets (quando a informação estiver disponível)"
                {...form.getInputProps("petsAllowed", { type: "checkbox" })}
              />

              <Divider />

              <TagsInput
                label="Palavras-chave para excluir"
                description='Imóveis com essas palavras no título ou descrição serão ignorados. Pressione Enter ou vírgula para adicionar.'
                placeholder="Ex: kitnet, studio, conjugado..."
                splitChars={[",", " ", "|"]}
                {...form.getInputProps("excludeKeywords")}
              />
            </Stack>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Save button */}
          {/* ---------------------------------------------------------------- */}
          <Group justify="flex-end">
            <Button
              type="submit"
              size="md"
              loading={saving}
              leftSection={<IconDeviceFloppy size={18} />}
            >
              Salvar Perfil
            </Button>
          </Group>
        </Stack>
      </form>
    </>
  );
}
