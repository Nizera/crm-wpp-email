<div align="center">

<h1>🚀 CRM + WhatsApp + E-mail Automation</h1>

<p><strong>Uma plataforma completa de prospecção e relacionamento com leads — Open Source, self-hosted e gratuita.</strong></p>

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-lightblue?logo=sqlite)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

</div>

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Execução](#-instalação-e-execução)
- [Configuração das Integrações](#-configuração-das-integrações)
  - [Resend (E-mail)](#resend-e-mail)
  - [Baileys (WhatsApp)](#baileys-whatsapp)
  - [Agente de IA](#agente-de-ia)
  - [Google Places API (Opcional)](#google-places-api-opcional)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Contribuir](#-como-contribuir)
- [Licença](#-licença)

---

## 💡 Sobre o Projeto

Este projeto é um **CRM self-hosted** focado em **prospecção outbound** para pequenas e médias empresas. Ele combina automação de e-mail, integração com WhatsApp e um agente de IA comercial em uma única plataforma com design premium dark mode.

### Por que este projeto existe?

Ferramentas como HubSpot, Pipedrive e ManyChat custam centenas de reais por mês. Este projeto oferece as mesmas capacidades de forma **gratuita e open source**, rodando diretamente na sua máquina ou servidor.

### Modo de operação

O sistema opera em dois modos:

| Modo | Quando ativa | Comportamento |
|---|---|---|
| **Real** | Quando APIs estão configuradas | Envia e-mails/WhatsApp de verdade |
| **Mock/Simulado** | Sem configuração | Simula tudo no terminal, sem cobranças |

> ✅ Você pode testar **100% das funcionalidades** sem configurar nenhuma API.

---

## ✨ Funcionalidades

### 🔍 Prospecção de Leads
- Busca por **cidade + nicho** (dentistas, restaurantes, academias, etc.)
- Integração com **OpenStreetMap/Overpass API** (gratuita, sem chave)
- Integração com **Google Places API** (opcional, traz telefone dos leads)
- Filtra automaticamente negócios **sem site** — seu público-alvo ideal
- Importação de leads com 1 clique para o CRM

### 📋 CRM de Contatos
- Tabela completa com busca, filtros por status, nicho e tags
- Modal de edição com histórico de e-mails e chat do WhatsApp
- Validação automática de número WhatsApp ao cadastrar/editar contatos
- Badges de status: 🟢 **Válido** / 🔴 **Sem WhatsApp** / 🟡 **Não Verificado**

### 📧 Automação de E-mail
- Templates de e-mail com variáveis dinâmicas (`{{name}}`, `{{city}}`, etc.)
- **Construtor visual de automações** (Flow Builder) com:
  - Nó: Enviar E-mail
  - Nó: Aguardar X dias
  - Nó: Condição Se/Então
  - Nó: Aplicar Tag
- Rastreamento de abertura, resposta e rejeição via webhook (Resend)

### 💬 WhatsApp Integrado
- **Tela de chat estilo WhatsApp Web** com listagem de contatos
- Envio e recebimento de mensagens via **Baileys** conectado ao WhatsApp Web
- **Agente de IA Comercial** que responde leads automaticamente (Gemini, OpenAI ou Mock)
- Ativar/desativar o agente por contato individualmente
- Polling automático para mensagens em tempo real

### ✅ Validação Automática de WhatsApp
- Verifica se o número existe no WhatsApp via Baileys
- Validação automática ao **criar** ou **alterar** o telefone de um contato
- Botão "Checar" manual no modal de edição e no cabeçalho do chat
- Modo Mock: número começa com `999` ou `000` = Sem WhatsApp

### ⚙️ Configurações Centralizadas
- Painel de configurações com todas as chaves de API
- Simulador de mensagem recebida para testar o agente
- Prompt personalizável para o agente de IA

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) |
| **Linguagem** | TypeScript |
| **Banco de Dados** | SQLite (via `better-sqlite3` / `sqlite` + `sqlite3`) |
| **Estilo** | CSS Vanilla (dark mode, glassmorphism, neon) |
| **Ícones** | [Lucide React](https://lucide.dev/) |
| **E-mail** | [Resend](https://resend.com/) |
| **WhatsApp** | [Baileys](https://github.com/WhiskeySockets/Baileys) |
| **Prospecção** | OpenStreetMap Overpass API + Google Places API |
| **IA** | Google Gemini / OpenAI GPT / Mock Rules |

---

## 📦 Pré-requisitos

- [Node.js](https://nodejs.org/) **18.17** ou superior
- npm **9+**
- Git

---

## 🚀 Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/Nizera/crm-wpp-email.git
cd crm-wpp-email

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** no navegador.

> 💡 O banco de dados SQLite é criado automaticamente na primeira execução. Nenhuma configuração adicional é necessária para começar.

### Portas customizadas

O projeto está configurado na porta `3005`. Para alterar, edite o `package.json`:

```json
"dev": "next dev -p 3005"
```

---

## ⚙️ Configuração das Integrações

Todas as configurações são feitas diretamente na página **Configurações** do CRM (`/configuracoes`), sem necessidade de criar arquivos `.env`.

### Resend (E-mail)

1. Crie uma conta em [resend.com](https://resend.com) (plano gratuito: 3.000 e-mails/mês)
2. Crie uma API Key
3. Adicione seu domínio verificado (ou use `onboarding@resend.dev` para testes)
4. Cole a chave em **Configurações → Resend API Key**

### Baileys (WhatsApp)

O WhatsApp conecta diretamente pelo CRM usando Baileys.

1. Acesse **Configuracoes -> WhatsApp**
2. Clique em **Conectar**
3. Escaneie o QR Code com o WhatsApp no celular em **Dispositivos conectados**
4. Mantenha o servidor do CRM ativo para enviar, receber e validar contatos

### Agente de IA

O agente responde automaticamente aos leads pelo WhatsApp. Configure em **Configurações → Agente de IA**:

| Provedor | Onde obter a chave | Observação |
|---|---|---|
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) | Gratuito com limites generosos |
| **OpenAI GPT** | [platform.openai.com](https://platform.openai.com) | Pago por token |
| **Mock (padrão)** | — | Respostas baseadas em regras, sem custo |

### Google Places API (Opcional)

Melhora a prospecção trazendo **telefone** dos leads diretamente do Google:

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Habilite a **Places API**
3. Crie uma chave de API
4. Cole em **Configurações → Google Places API Key**

> 💡 **Sem essa chave**, o sistema usa OpenStreetMap (gratuito) que raramente traz telefone. **Com a chave**, a maioria dos leads vem com telefone — o que é essencial para a validação e prospecção via WhatsApp.
>
> O Google oferece **$200 de crédito gratuito por mês**, o que equivale a ~540 buscas de leads sem custo.

---

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── automation/run/       # Motor de execução de automações
│   │   ├── automations/          # CRUD de fluxos de automação
│   │   ├── contacts/             # CRUD de contatos + validação WA
│   │   ├── dashboard/stats/      # Estatísticas do painel
│   │   ├── leads/search/         # Prospecção (Overpass + Google Places)
│   │   ├── settings/             # Leitura/escrita de configurações
│   │   ├── templates/            # CRUD de templates de e-mail
│   │   ├── webhooks/             # Webhook inbound do Resend
│   │   └── whatsapp/
│   │       ├── chats/            # Lista de conversas WhatsApp
│   │       ├── check-number/     # Validação de número WA
│   │       ├── messages/         # Histórico de mensagens
│   │       ├── send/             # Envio manual de mensagem
│   │       ├── simulate-receive/ # Simulador de mensagem recebida
│   │       ├── toggle-agent/     # Ativar/desativar agente de IA
│   │       └── baileys/          # Conexao direta com WhatsApp Web
│   ├── automacoes/               # Página de automações + Flow Builder
│   ├── configuracoes/            # Página de configurações
│   ├── contatos/                 # Página de CRM de contatos
│   ├── modelos/                  # Página de templates de e-mail
│   ├── prospeccao/               # Página de prospecção de leads
│   ├── whatsapp/                 # Tela de chat WhatsApp Web
│   ├── globals.css               # Design system completo
│   └── layout.tsx
├── components/
│   └── Sidebar.tsx               # Navegação lateral
└── lib/
    ├── db.ts                     # Conexão e migrações do SQLite
    ├── resend.ts                 # Helpers de e-mail
    └── whatsapp.ts               # Helpers de WhatsApp + IA
```

---

## 🤝 Como Contribuir

Contribuições são muito bem-vindas! Este projeto é para a comunidade.

### Fluxo de contribuição

```bash
# 1. Faça um fork do projeto
# 2. Clone seu fork
git clone https://github.com/SEU-USUARIO/crm-wpp-email.git

# 3. Crie uma branch para sua feature
git checkout -b feature/minha-feature

# 4. Faça suas alterações e commit
git commit -m "feat: descrição da sua feature"

# 5. Push e abra um Pull Request
git push origin feature/minha-feature
```

### Ideias de contribuição

- [ ] Suporte a múltiplas instâncias WhatsApp
- [ ] Exportar contatos para CSV/Excel
- [ ] Dashboard com gráficos de conversão
- [ ] Integração com Telegram
- [ ] App mobile (React Native)
- [ ] Deploy com Docker Compose
- [ ] Tradução para inglês/espanhol
- [ ] Testes automatizados (Jest/Playwright)

### Reportar Bugs

Abra uma [Issue](https://github.com/Nizera/crm-wpp-email/issues) descrevendo:
- O que aconteceu
- O que era esperado
- Passos para reproduzir
- Versão do Node.js e OS

---

## 📄 Licença

Este projeto está sob a licença **MIT** — veja o arquivo [LICENSE](LICENSE) para detalhes.

```
MIT License — você pode usar, copiar, modificar e distribuir livremente,
inclusive em projetos comerciais, desde que mantenha os créditos.
```

---

<div align="center">

Feito com ❤️ para a comunidade brasileira de desenvolvedores e empreendedores.

⭐ **Se este projeto te ajudou, deixe uma estrela no repositório!**

</div>
