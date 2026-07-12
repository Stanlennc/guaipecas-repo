window.GUISCHEDULES_DATA = {
  "version": 1,
  "timezone": "America/Sao_Paulo",
  "feeds": {
    "rivers": {
      "workflow": "update-rivers.yml",
      "cron": "7,22,37,52 * * * *",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 2,
      "interval_minutes": 15,
      "label": "espelha o Nível Guaíba (a cada 15 minutos; backup a cada 2 h)",
      "short_label": "15 min"
    },
    "bairros": {
      "workflow": "update-bairros-alerta.yml",
      "cron": "12,27,42,57 * * * *",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 3,
      "interval_minutes": 15,
      "label": "alerta por bairro com IA (a cada 15 minutos)",
      "short_label": "15 min"
    },
    "news": {
      "workflow": "update-news.yml",
      "cron": "0 */2 * * *",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 4,
      "interval_minutes": 120,
      "label": "atualiza a cada 2 horas",
      "short_label": "2 h"
    },
    "offers": {
      "workflow": "update-offers.yml",
      "cron": "0 */2 * * *",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 5,
      "interval_minutes": 120,
      "label": "atualiza a cada 2 horas",
      "short_label": "2 h"
    },
    "editais": {
      "workflow": "update-editais.yml",
      "cron": "0 */6 * * *",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 4,
      "interval_minutes": 360,
      "label": "atualiza a cada 6 horas",
      "short_label": "6 h"
    },
    "servicos": {
      "workflow": "update-servicos.yml",
      "cron": "0 11 * * *",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 5,
      "interval_minutes": 1440,
      "label": "atualiza diariamente às 8h",
      "short_label": "diário 8h"
    },
    "explorar": {
      "workflow": "update-explorar.yml",
      "cron": "0 21 * * 4",
      "cron_timezone": "UTC",
      "fetch_delay_minutes": 5,
      "interval_minutes": 10080,
      "label": "atualiza às quintas-feiras, 18h",
      "short_label": "qui. 18h"
    },
    "contatos": {
      "manual": true,
      "label": "revisão manual periódica",
      "short_label": "manual"
    },
    "saude": {
      "manual": true,
      "label": "revisão manual periódica",
      "short_label": "manual"
    }
  }
};
