"use client";

import { Title, Text, Group, ThemeIcon, Table, Alert } from "@mantine/core";
import { IconActivity, IconInfoCircle } from "@tabler/icons-react";

export default function RunsPage() {
  return (
    <>
      <Group mb="xs" gap="sm">
        <ThemeIcon size="lg" variant="light" color="violet">
          <IconActivity size={20} />
        </ThemeIcon>
        <Title order={2}>Execuções do Scraper</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="xl">
        Histórico de execuções automáticas de coleta de dados.
      </Text>

      <Alert
        icon={<IconInfoCircle size={16} />}
        title="Em construção"
        color="violet"
        mb="xl"
      >
        O histórico de execuções será preenchido automaticamente após configurar
        e executar o scraper (Fase 2).
      </Alert>

      {/* Empty table shell */}
      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fonte</Table.Th>
              <Table.Th>Início</Table.Th>
              <Table.Th>Fim</Table.Th>
              <Table.Th>Encontrados</Table.Th>
              <Table.Th>Novos</Table.Th>
              <Table.Th>Atualizados</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Erros</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text ta="center" c="dimmed" py="xl" size="sm">
                  Nenhuma execução registrada ainda.
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </>
  );
}
