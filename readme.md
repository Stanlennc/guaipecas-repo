# Automação do nível dos rios — Guaíba em Dia

Este pacote deixa o painel de "Nível dos Rios" da home genuinamente automático,
atualizando sozinho a cada 30 minutos — sem precisar de servidor pago.

## Como funciona

1. Um workflow do GitHub Actions roda a cada 30 min.
2. Ele chama a API oficial da ANA (HidroWebService) com suas credenciais.
3. Salva um arquivo `rivers.json` na raiz do site.
4. O navegador do visitante lê esse `rivers.json` (arquivo estático, mesmo
   domínio — sem problema de CORS) e atualiza os cards na hora.

Resultado: os números na home passam a refletir sempre a última coleta feita
pelo robô, sem você precisar editar nada manualmente.

## Passo 1 — Pedir acesso à API da ANA (é grátis, mas precisa de e-mail)

Envie um e-mail para a ANA pedindo acesso ao HidroWebService. Use o modelo
abaixo (arquivo `email-modelo.txt`). Eles normalmente respondem em poucos dias
úteis com um usuário e senha de API.

## Passo 2 — Guardar as credenciais como "Secrets" no GitHub

No repositório do site no GitHub:
Settings → Secrets and variables → Actions → New repository secret

Crie dois secrets:

- `ANA_API_USER`
- `ANA_API_PASSWORD`

(Nunca coloque usuário/senha direto no código — é por isso que usamos secrets.)

## Passo 3 — Ativar o workflow

O arquivo `.github/workflows/update-rivers.yml` já está pronto. Assim que ele
estiver no seu repositório (junto com `automation/fetch_rivers.py`), o GitHub já roda
sozinho a cada 30 minutos. Dá pra também rodar manualmente pela aba "Actions"
do repositório, clicando em "Run workflow".

## Passo 4 — Publicar

Depois que o `rivers.json` for gerado pela primeira vez, o `script.js` do site
já está preparado pra ler esse arquivo e substituir os números estáticos
pelos dados reais. Basta publicar normalmente (Netlify, GitHub Pages, etc.)
com todos os arquivos juntos, incluindo o `rivers.json` gerado.

## Estações usadas

- Guaíba (Cais Mauá, Porto Alegre) — referência histórica da bacia
- Jacuí (Dona Francisca) — alerta antecipado, 24–30h antes do Guaíba

Os códigos de estação exatos precisam ser confirmados no cadastro da ANA
(ficam disponíveis assim que o acesso for liberado) e preenchidos no arquivo
`automation/fetch_rivers.py`, nas linhas marcadas com `# TODO`.
