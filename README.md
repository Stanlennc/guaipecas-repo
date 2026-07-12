# Guaipecaz

Portal cidadão de Guaíba e região — notícias, rios, saúde, editais e serviços.

**Site:** https://stanlennc.github.io/guaipecaz/

## Renomear o repositório no GitHub

Para o novo endereço funcionar, renomeie o repositório em **Settings → General → Repository name**:

- de `guaipecas-repo` → `guaipecaz`

Depois atualize o remote local:

```bash
git remote set-url origin https://github.com/Stanlennc/guaipecaz.git
git push
```

Em **Settings → Pages**, confirme que a publicação continua ativa (branch `main`, pasta `/`).

## Domínio próprio (opcional)

Se registrar `guaipecaz.com.br` (ou `.com`), em **Settings → Pages → Custom domain** informe o domínio e configure o DNS conforme o GitHub indicar. Atualize `automation/site_config.py` com a URL definitiva.

## GA4

No Google Analytics, renomeie o fluxo para **Guaipecaz Web** e atualize a URL do site para o novo endereço.
