# SuperVisao - Sistema de Gestao de Metas

Sistema web para orientar supervisoras sobre metas e segmentacao de revendedores, utilizando CSV como banco de dados.

## Requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0

## Instalacao Local

1. Clone o repositorio ou extraia os arquivos

2. Instale as dependencias:
```bash
npm run install:all
```

Ou manualmente:
```bash
npm install
cd client && npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

O servidor backend estara em `http://localhost:3001` e o frontend em `http://localhost:5173`.

## Estrutura do Projeto

```
/
├── server/
│   ├── index.js           # Servidor Express principal
│   ├── lib/
│   │   ├── csvLoader.js   # Carregador e parser de CSV
│   │   ├── calc.js        # Calculos de segmentacao
│   │   └── auth.js        # Autenticacao
│   └── data/
│       ├── config.json    # Configuracoes
│       ├── snapshot_manha.csv
│       ├── snapshot_tarde.csv
│       └── sample.csv     # CSV de exemplo
├── client/
│   ├── src/
│   │   ├── pages/         # Paginas React
│   │   ├── components/    # Componentes reutilizaveis
│   │   └── utils/         # Utilitarios e API
│   └── index.html
├── package.json
└── README.md
```

## Deploy no Render (Gratuito)

### 1. Preparacao

Certifique-se de que o codigo esta em um repositorio Git (GitHub, GitLab, etc.).

### 2. Criar Web Service no Render

1. Acesse [render.com](https://render.com) e faca login
2. Clique em "New +" > "Web Service"
3. Conecte seu repositorio Git
4. Configure:
   - **Name**: supervision-games (ou outro nome)
   - **Region**: escolha a mais proxima
   - **Branch**: main
   - **Root Directory**: (deixe vazio)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Free

5. Adicione variaveis de ambiente (opcional, para maior seguranca):
   - `ADMIN_USER`: acqua
   - `ADMIN_PASS`: 13707
   - `SECRET_KEY`: uma-chave-secreta-longa
   - `NODE_ENV`: production

6. Clique em "Create Web Service"

### 3. Health Check

O Render (ou UptimeRobot) pode usar o endpoint:
```
GET /api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "service": "supervision-games",
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

## Uso do Sistema

### Para Supervisoras

1. Acesse a pagina inicial
2. Digite o codigo do seu setor (ex: 14210)
3. Visualize o dashboard com:
   - KPIs do setor
   - Cards de cada revendedor com progresso
   - Comparativo manha vs tarde (se disponivel)
   - Graficos e tabelas

### Codigos de Setor Disponiveis

- 1260, 4005, 8238, 8239, 14210, 16283, 16289, 16471
- 17539, 18787, 19699, 23032, 23336, 15775, 1414, 1415
- 3124, 8317, 9540, 14211, 14244, 14245, 14246, 15242
- 15774, 16284, 16472, 16635, 18788, 19698, 23557

### Para Administradores

1. Acesse `/login` ou clique em "Admin" no menu
2. Credenciais:
   - Usuario: `acqua`
   - Senha: `13707`

3. No painel administrativo:
   - **Upload de CSVs**: Carregue os snapshots da manha e tarde
   - **Snapshot Ativo**: Selecione qual snapshot as supervisoras verao
   - **Ciclo Atual**: Defina o ciclo vigente (01/2026 a 09/2026)
   - **Representatividade**: Ajuste os percentuais por ciclo (deve somar 100%)
   - **% Risco**: Defina o limiar para alertas de revendedores em risco

## Formato do CSV

O CSV deve conter as seguintes colunas (separador `;` ou `,`):

| Coluna | Descricao |
|--------|-----------|
| Setor | Identificador do setor (ex: "14210 FVC - 13706 - A - ALCINA MARIA 1") |
| CodigoRevendedor | Codigo unico do revendedor |
| NomeRevendedora | Nome completo da revendedora |
| CicloFaturamento | Ciclo (ex: "01/2026") |
| CodigoProduto | Codigo do produto |
| NomeProduto | Nome do produto |
| QuantidadeItens | Quantidade |
| ValorPraticado | Valor em reais (formato BR: "1.234,56") |
| Tipo | "Venda" ou "Devolucao" |

**Importante**: Apenas linhas com `Tipo = "Venda"` sao consideradas no calculo.

## Regras de Segmentacao

| Segmento | Minimo para Manter | Minimo para Subir |
|----------|-------------------|-------------------|
| Iniciante | R$ 0 | R$ 2.999,99 |
| Bronze | R$ 2.999,99 | R$ 3.000,00 |
| Prata | R$ 3.000,00 | R$ 9.000,00 |
| Ouro | R$ 9.000,00 | R$ 20.000,00 |
| Platina | R$ 20.000,00 | R$ 50.000,00 |
| Rubi | R$ 50.000,00 | R$ 80.000,00 |
| Esmeralda | R$ 80.000,00 | R$ 130.000,00 |
| Diamante | R$ 130.000,00 | - |

Os valores sao calculados com base no total comprado em 9 ciclos.

## Representatividade por Ciclo (Padrao)

| Ciclo | % |
|-------|---|
| 01/2026 | 8% |
| 02/2026 | 11% |
| 03/2026 | 11% |
| 04/2026 | 12% |
| 05/2026 | 11% |
| 06/2026 | 15% |
| 07/2026 | 10% |
| 08/2026 | 11% |
| 09/2026 | 10% |

A meta do ciclo atual e calculada como:
```
metaCiclo = metaTotal * representatividade%
```

## API Endpoints

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /api/health | Health check |
| POST | /api/admin/login | Login admin |
| POST | /api/admin/logout | Logout admin |
| GET | /api/admin/check | Verifica autenticacao |
| GET | /api/admin/config | Obtem configuracoes |
| PUT | /api/admin/config | Atualiza configuracoes |
| POST | /api/admin/upload?slot=manha\|tarde | Upload CSV |
| GET | /api/dashboard?setorId=X | Dashboard do setor |
| GET | /api/revendedor?setorId=X&codigoRevendedor=Y | Detalhe revendedor |
| GET | /api/setores | Lista de setores |

## Fluxo de Atualizacao de Dados

1. **08:00** - Admin faz upload do CSV da manha
2. **17:30** - Admin faz upload do CSV da tarde
3. O sistema compara automaticamente manha vs tarde
4. Supervisoras veem o snapshot ativo (configuravel)

## Troubleshooting

### CSV nao carrega
- Verifique o formato do arquivo (UTF-8)
- Confirme que as colunas obrigatorias existem
- Valores monetarios devem estar no formato brasileiro (1.234,56)

### Setor nao encontrado
- Verifique se o codigo do setor esta correto
- O codigo e extraido do inicio da coluna Setor (primeiro numero)

### Login nao funciona
- Verifique as credenciais: acqua / 13707
- Limpe os cookies do navegador
- Aguarde 15 minutos se bloqueado por muitas tentativas

## Desenvolvimento

### Scripts disponiveis

```bash
npm run dev          # Inicia backend e frontend
npm run dev:server   # Apenas backend
npm run dev:client   # Apenas frontend
npm run build        # Build de producao
npm start            # Inicia em producao
```

### Variaveis de ambiente

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| PORT | Porta do servidor | 3001 |
| NODE_ENV | Ambiente | development |
| ADMIN_USER | Usuario admin | acqua |
| ADMIN_PASS | Senha admin | 13707 |
| SECRET_KEY | Chave para tokens | (definida no codigo) |

## Licenca

Projeto interno - Todos os direitos reservados.
