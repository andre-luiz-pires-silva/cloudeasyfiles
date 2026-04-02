import type { Locale } from "../../lib/i18n/I18nProvider";
import type { AwsRestoreTier } from "../../lib/tauri/awsConnections";
import type { AwsUploadStorageClass } from "../connections/awsUploadStorageClasses";

type LocalizedString = Record<Locale, string>;

type AwsUploadTierContent = {
  storageClass: AwsUploadStorageClass;
  title: LocalizedString;
  useCase: LocalizedString;
  availability: LocalizedString;
  cost: LocalizedString;
};

type AwsRestoreTierContent = {
  tier: AwsRestoreTier;
  title: LocalizedString;
  eta: LocalizedString;
  cost: LocalizedString;
  useCase: LocalizedString;
};

const AWS_UPLOAD_STORAGE_CLASSES_DOCUMENTATION_URL =
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html";
const AWS_PRICING_DOCUMENTATION_URL = "https://aws.amazon.com/s3/pricing/";
const AWS_RESTORE_DOCUMENTATION_URL =
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html";

const AWS_UPLOAD_TIER_CONTENT: AwsUploadTierContent[] = [
  {
    storageClass: "STANDARD",
    title: {
      "en-US": "S3 Standard",
      "pt-BR": "S3 Standard"
    },
    useCase: {
      "en-US":
        "For frequent access with low latency and high availability across multiple Availability Zones.",
      "pt-BR":
        "Para acesso frequente com baixa latência e alta disponibilidade em múltiplas zonas."
    },
    availability: {
      "en-US": "Immediate millisecond access, multi-AZ.",
      "pt-BR": "Acesso imediato em milissegundos, multi-AZ."
    },
    cost: {
      "en-US": "Highest storage cost, without infrequent-access savings.",
      "pt-BR":
        "Maior custo de armazenamento, sem foco em economia por acesso infrequente."
    }
  },
  {
    storageClass: "STANDARD_IA",
    title: {
      "en-US": "S3 Standard-Infrequent Access",
      "pt-BR": "S3 Standard-Infrequent Access"
    },
    useCase: {
      "en-US": "For data accessed less often but still needing rapid access.",
      "pt-BR":
        "Para dados acessados com pouca frequência, mas que ainda precisam de acesso rápido."
    },
    availability: {
      "en-US": "Immediate millisecond access, multi-AZ.",
      "pt-BR": "Acesso imediato em milissegundos, multi-AZ."
    },
    cost: {
      "en-US":
        "Lower storage cost than Standard, with retrieval charges and minimum storage duration.",
      "pt-BR":
        "Armazenamento mais barato que Standard, com cobrança de recuperação e retenção mínima."
    }
  },
  {
    storageClass: "ONEZONE_IA",
    title: {
      "en-US": "S3 One Zone-Infrequent Access",
      "pt-BR": "S3 One Zone-Infrequent Access"
    },
    useCase: {
      "en-US": "For infrequently accessed data that can live in a single Availability Zone.",
      "pt-BR":
        "Para dados pouco acessados que aceitam ficar em uma única zona de disponibilidade."
    },
    availability: {
      "en-US": "Immediate millisecond access, single AZ.",
      "pt-BR": "Acesso imediato em milissegundos, zona única."
    },
    cost: {
      "en-US": "Lower cost than Standard-IA, with less resilience and retrieval charges.",
      "pt-BR":
        "Menor custo que Standard-IA, com menor resiliência e cobrança de recuperação."
    }
  },
  {
    storageClass: "INTELLIGENT_TIERING",
    title: {
      "en-US": "S3 Intelligent-Tiering",
      "pt-BR": "S3 Intelligent-Tiering"
    },
    useCase: {
      "en-US":
        "For data with unpredictable access patterns, allowing automatic movement across tiers.",
      "pt-BR":
        "Para dados com padrão de acesso imprevisível, permitindo otimização automática entre tiers."
    },
    availability: {
      "en-US": "Immediate access for frequent/infrequent tiers; archive tiers require restore.",
      "pt-BR":
        "Acesso imediato para tiers frequentes/infrequentes; archive tiers exigem restore."
    },
    cost: {
      "en-US":
        "Avoids overcommitting to one class, but adds monitoring and automation charges.",
      "pt-BR":
        "Evita superprovisionar storage class, mas inclui cobrança de monitoramento e automação."
    }
  },
  {
    storageClass: "GLACIER_IR",
    title: {
      "en-US": "S3 Glacier Instant Retrieval",
      "pt-BR": "S3 Glacier Instant Retrieval"
    },
    useCase: {
      "en-US":
        "For long-term archive data that still needs immediate millisecond retrieval.",
      "pt-BR":
        "Para arquivamento de longo prazo com necessidade de recuperação imediata em milissegundos."
    },
    availability: {
      "en-US": "Immediate millisecond access for rarely accessed archived data.",
      "pt-BR":
        "Acesso imediato em milissegundos, voltado a dados raramente acessados."
    },
    cost: {
      "en-US":
        "Low storage cost with retrieval charges and archive-style minimum duration.",
      "pt-BR":
        "Armazenamento baixo com cobrança de recuperação e retenção mínima de arquivamento."
    }
  },
  {
    storageClass: "GLACIER",
    title: {
      "en-US": "S3 Glacier Flexible Retrieval",
      "pt-BR": "S3 Glacier Flexible Retrieval"
    },
    useCase: {
      "en-US":
        "For long-term archives where restore times of minutes or hours are acceptable.",
      "pt-BR":
        "Para arquivamento de longo prazo quando tempos de restore de minutos ou horas são aceitáveis."
    },
    availability: {
      "en-US": "Archived objects; restore required before normal use.",
      "pt-BR": "Objetos arquivados; exige restore antes do uso normal."
    },
    cost: {
      "en-US":
        "Very low storage cost, with meaningful restore and minimum-retention tradeoffs.",
      "pt-BR":
        "Storage muito barato, com restore e retenção mínima relevantes."
    }
  },
  {
    storageClass: "DEEP_ARCHIVE",
    title: {
      "en-US": "S3 Glacier Deep Archive",
      "pt-BR": "S3 Glacier Deep Archive"
    },
    useCase: {
      "en-US": "For lowest-cost long-term retention with very rare access.",
      "pt-BR": "Para retenção de longo prazo com custo mínimo e acesso muito raro."
    },
    availability: {
      "en-US": "Deep archive; restore is typically slower.",
      "pt-BR": "Arquivamento profundo; restore normalmente mais lento."
    },
    cost: {
      "en-US": "Lowest storage cost, with slower restores and longer minimum retention.",
      "pt-BR":
        "Menor custo de armazenamento, com restore mais demorado e retenção mínima maior."
    }
  }
];

const AWS_RESTORE_TIER_CONTENT: AwsRestoreTierContent[] = [
  {
    tier: "expedited",
    title: {
      "en-US": "Expedited",
      "pt-BR": "Expedited"
    },
    eta: {
      "en-US": "Usually 1 to 5 minutes",
      "pt-BR": "Normalmente 1 a 5 minutos"
    },
    cost: {
      "en-US": "Highest request cost",
      "pt-BR": "Maior custo de solicitação"
    },
    useCase: {
      "en-US": "Use when the file is urgent and retrieval speed matters more than cost.",
      "pt-BR":
        "Use quando o arquivo é urgente e a velocidade importa mais do que o custo."
    }
  },
  {
    tier: "standard",
    title: {
      "en-US": "Standard",
      "pt-BR": "Standard"
    },
    eta: {
      "en-US": "Usually 3 to 5 hours",
      "pt-BR": "Normalmente 3 a 5 horas"
    },
    cost: {
      "en-US": "Balanced cost",
      "pt-BR": "Custo equilibrado"
    },
    useCase: {
      "en-US":
        "Use for most restores when you want a practical balance between speed and cost.",
      "pt-BR":
        "Use na maioria das restaurações quando você quer um equilíbrio prático entre velocidade e custo."
    }
  },
  {
    tier: "bulk",
    title: {
      "en-US": "Bulk",
      "pt-BR": "Bulk"
    },
    eta: {
      "en-US": "Usually 5 to 12 hours",
      "pt-BR": "Normalmente 5 a 12 horas"
    },
    cost: {
      "en-US": "Lowest request cost",
      "pt-BR": "Menor custo de solicitação"
    },
    useCase: {
      "en-US": "Use for large or non-urgent retrievals when cost matters more than speed.",
      "pt-BR":
        "Use para recuperações grandes ou não urgentes quando o custo importa mais do que a velocidade."
    }
  }
];

function localize(locale: Locale, value: LocalizedString) {
  return value[locale];
}

export function getAwsUploadTierContent(locale: Locale) {
  return {
    label: locale === "pt-BR" ? "Tier de upload AWS" : "AWS upload tier",
    helper:
      locale === "pt-BR"
        ? "Escolha a classe de armazenamento usada pelos novos uploads feitos por esta conexão no app. Essa configuração não altera objetos que já estejam salvos na AWS."
        : "Choose the storage class used for new uploads made through this connection in the app. This setting does not change objects that are already stored in AWS.",
    availabilityLabel: locale === "pt-BR" ? "Disponibilidade" : "Availability",
    costLabel: locale === "pt-BR" ? "Custo" : "Cost",
    awsCodeLabel: locale === "pt-BR" ? "Código AWS" : "AWS code",
    noteTitle:
      locale === "pt-BR"
        ? "Transparência de custo e disponibilidade"
        : "Cost and availability transparency",
    noteBody:
      locale === "pt-BR"
        ? "Os comparativos abaixo são qualitativos e podem variar por região, volume, retenção mínima e cobranças de recuperação. Consulte a tabela oficial em"
        : "The comparisons below are qualitative and can vary by region, volume, minimum retention, and retrieval charges. Check the official table at",
    noteDocsBody:
      locale === "pt-BR"
        ? "Para detalhes completos de comportamento e elegibilidade de cada classe de armazenamento, consulte"
        : "For complete behavior and eligibility details for each storage class, see",
    pricingDocsLabel: locale === "pt-BR" ? "preços do Amazon S3" : "Amazon S3 pricing",
    storageClassesDocsLabel:
      locale === "pt-BR"
        ? "classes de armazenamento do Amazon S3"
        : "Amazon S3 storage classes",
    pricingDocumentationUrl: AWS_PRICING_DOCUMENTATION_URL,
    storageClassesDocumentationUrl: AWS_UPLOAD_STORAGE_CLASSES_DOCUMENTATION_URL,
    options: AWS_UPLOAD_TIER_CONTENT.map((option) => ({
      storageClass: option.storageClass,
      title: localize(locale, option.title),
      useCase: localize(locale, option.useCase),
      availability: localize(locale, option.availability),
      cost: localize(locale, option.cost)
    }))
  };
}

export function getAwsRestoreTierContent(locale: Locale) {
  return {
    pricingDocumentationUrl: AWS_PRICING_DOCUMENTATION_URL,
    restoreDocumentationUrl: AWS_RESTORE_DOCUMENTATION_URL,
    options: AWS_RESTORE_TIER_CONTENT.map((option) => ({
      tier: option.tier,
      title: localize(locale, option.title),
      eta: localize(locale, option.eta),
      cost: localize(locale, option.cost),
      useCase: localize(locale, option.useCase)
    }))
  };
}
