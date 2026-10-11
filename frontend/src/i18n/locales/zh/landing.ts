export default {
  batchImageGuide: {
    title: '图片批量生成',
    description: '一次提交多条提示词，任务完成后可统一下载图片结果'
  },
  // Home Page
  home: {
    backToHome: '返回首页',
    viewOnGithub: '在 GitHub 上查看',
    viewDocs: '查看文档',
    docs: '文档',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    dashboard: '控制台',
    login: '登录',
    getStarted: '立即开始',
    goToDashboard: '进入控制台',
    // 新增：面向用户的价值主张
    heroSubtitle: '一个密钥，畅用多个 AI 模型',
    heroDescription: '无需管理多个订阅账号，一站式接入 Claude、GPT、Gemini 等主流 AI 服务',
    tags: {
      subscriptionToApi: '订阅转 API',
      stickySession: '会话保持',
      realtimeBilling: '按量计费'
    },
    // 用户痛点区块
    painPoints: {
      title: '你是否也遇到这些问题？',
      items: {
        expensive: {
          title: '订阅费用高',
          desc: '每个 AI 服务都要单独订阅，每月支出越来越多'
        },
        complex: {
          title: '多账号难管理',
          desc: '不同平台的账号、密钥分散各处，管理起来很麻烦'
        },
        unstable: {
          title: '服务不稳定',
          desc: '单一账号容易触发限制，影响正常使用'
        },
        noControl: {
          title: '用量无法控制',
          desc: '不知道钱花在哪了，也无法限制团队成员的使用'
        }
      }
    },
    // 解决方案区块
    solutions: {
      title: '我们帮你解决',
      subtitle: '简单三步，开始省心使用 AI'
    },
    features: {
      unifiedGateway: '一键接入',
      unifiedGatewayDesc: '获取一个 API 密钥，即可调用所有已接入的 AI 模型，无需分别申请。',
      multiAccount: '稳定可靠',
      multiAccountDesc: '智能调度多个上游账号，自动切换和负载均衡，告别频繁报错。',
      balanceQuota: '用多少付多少',
      balanceQuotaDesc: '按实际使用量计费，支持设置配额上限，团队用量一目了然。'
    },
    // 优势对比
    comparison: {
      title: '为什么选择我们？',
      headers: {
        feature: '对比项',
        official: '官方订阅',
        us: '本平台'
      },
      items: {
        pricing: {
          feature: '付费方式',
          official: '固定月费，用不完也付',
          us: '按量付费，用多少付多少'
        },
        models: {
          feature: '模型选择',
          official: '单一服务商',
          us: '多模型随意切换'
        },
        management: {
          feature: '账号管理',
          official: '每个服务单独管理',
          us: '统一密钥，一站管理'
        },
        stability: {
          feature: '服务稳定性',
          official: '单账号易触发限制',
          us: '多账号池，自动切换'
        },
        control: {
          feature: '用量控制',
          official: '无法限制',
          us: '可设配额、查明细'
        }
      }
    },
    providers: {
      title: '已支持的 AI 模型',
      description: '一个 API，多种选择',
      supported: '已支持',
      soon: '即将推出',
      claude: 'Claude',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      more: '更多'
    },
    // CTA 区块
    cta: {
      title: '准备好开始了吗？',
      description: '注册即可获得免费试用额度，体验一站式 AI 服务',
      button: '免费注册'
    },
    // 首页（落地页）
    landing: {
      nav: {
        usage: '用量查询'
      },
      hero: {
        badge: '大模型 API 中转',
        tagline: '一个密钥，接入所有大模型',
        description: 'Claude、GPT、Gemini、DeepSeek 等主流模型，一个接口直连。兼容官方协议与 SDK，只需改一行 Base URL。',
        browseModels: '浏览模型',
        howToConnect: '查看接入方式'
      },
      console: {
        request: '请求',
        response: '响应',
        composing: '编写请求',
        routing: '路由中',
        streaming: '流式输出',
        waiting: '等待响应',
        client: '你的应用',
        input: '输入',
        output: '输出',
        prompt: '用一句话介绍你自己。',
        replies: {
          claude: '我是 Claude，由 Anthropic 训练的 AI 助手，擅长写作、分析和编程，乐于把复杂的问题讲清楚。',
          gpt: '我是 GPT，由 OpenAI 训练的大语言模型，可以帮你写作、编程、翻译，也能陪你一起梳理思路。',
          gemini: '我是 Gemini，由 Google 训练的多模态模型，能理解文字、图片和代码，并给出有条理的回答。',
          deepseek: '我是 DeepSeek，由深度求索开发的大模型，擅长逐步推理和代码生成，回答直接而严谨。'
        }
      },
      providers: {
        title: '主流模型，一处接入'
      },
      features: {
        eyebrow: '能力',
        title: '把复杂留给网关，把简单留给你',
        description: '账号、线路、计费这些琐事由我们处理。你只需要一个密钥，和一行接口地址。',
        demo: '演示',
        oneKey: {
          title: '一个密钥，全部模型',
          desc: '不必为每家厂商分别注册、充值、保管密钥。换模型只是改一个参数。',
          hint: '点任意模型，用同一把密钥发起一次调用',
          yourKey: '你的密钥',
          log: '调用记录'
        },
        routing: {
          title: '智能调度，自动切换',
          desc: '多条上游线路同时待命。某一路限流或出错时，请求会自动切到健康的线路。',
          hint: '点任意线路，模拟一次故障',
          upstream: '上游',
          log: '调度日志',
          evDown: '{name} 返回 429，暂停调度',
          evSwitch: '流量切换至 {name}',
          evUp: '{name} 恢复，重新参与调度',
          evBlocked: '所有线路不可用，请求排队等待'
        },
        billing: {
          title: '按量计费，用量透明',
          desc: '按实际消耗的 Token 结算，每一次调用都有明细可查。',
          hint: '点任意一行，查看这笔费用的构成',
          today: '今日消费',
          sample: '示例数据',
          input: '输入',
          output: '输出',
          cache: '缓存命中'
        },
        compat: {
          title: '兼容官方协议与 SDK',
          desc: '原生支持 Anthropic、OpenAI、Gemini 的接口格式。已有的代码和工具，只改接口地址就能迁移。',
          terminal: '终端',
          connected: '已接入 {name}'
        },
        stream: {
          title: '流式直通',
          desc: '响应以 SSE 原样转发，模型生成一个字，你就收到一个字。'
        },
        sticky: {
          title: '会话保持',
          desc: '同一段对话固定走同一条线路，上下文缓存持续生效。'
        },
        quota: {
          title: '额度可控',
          desc: '为每个密钥设置额度与速率上限，团队用量一目了然。'
        }
      },
      quickstart: {
        eyebrow: '接入',
        title: '三步接入，几分钟上线',
        steps: {
          signup: {
            title: '注册并登录',
            desc: '创建账号，进入控制台。'
          },
          key: {
            title: '创建 API 密钥',
            desc: '选择分组，生成属于你的密钥。'
          },
          call: {
            title: '替换 Base URL',
            desc: '把请求地址换成本站，其余代码保持不变。'
          }
        },
        hello: '你好',
        copy: '复制',
        copied: '已复制'
      },
      pricing: {
        eyebrow: '价格',
        title: '用多少，付多少',
        lead: '按 Token 用量结算，价格怎么算一行就能说清，每一笔都查得到。',
        formula: {
          price: '模型单价',
          rate: '分组倍率',
          usage: 'Token 用量',
          cost: '费用'
        },
        model: '模型',
        input: '输入',
        output: '输出',
        unit: '单位：美元 / 百万 Token，已乘分组倍率',
        viewAll: '查看全部 {count} 个模型',
        facts: {
          token: {
            title: '按 Token 计费',
            desc: '每次调用按输入、输出和缓存的 Token 数量分别计价，用了多少算多少。'
          },
          rate: {
            title: '分组倍率',
            desc: '不同分组有各自的价格倍率，实付价等于模型单价乘以所在分组的倍率。'
          },
          records: {
            title: '明细可查',
            desc: '每一笔调用的 Token 用量和费用都记在使用记录里，随时可以核对。'
          }
        }
      },
      faq: {
        eyebrow: '常见问题',
        title: '开始之前，你可能想知道',
        lead: '没找到答案？登录后可以在控制台查看公告和文档。',
        items: {
          what: {
            q: '{siteName} 是什么？',
            a: '一个大模型 API 中转服务。注册后创建一把密钥，就可以用同一个接口地址调用已接入的各家模型，不必分别去每家申请和管理账号。'
          },
          connect: {
            q: '怎么接入现有的工具和代码？',
            a: '接口兼容 Anthropic Messages、OpenAI Chat Completions / Responses 和 Gemini 的原生协议。把官方 SDK 或客户端里的 Base URL 换成本站地址，再填入你的密钥即可，其余代码不用改。'
          },
          models: {
            q: '支持哪些模型？',
            a: '以后台实际接入的为准。登录后可以在控制台看到当前可用的分组和模型列表。'
          },
          billing: {
            q: '怎么计费？',
            a: '按 Token 用量计费，实付价等于模型单价乘以所在分组的倍率。每一笔调用的用量和费用都能在使用记录里查到。'
          },
          failover: {
            q: '某条线路出问题了会怎样？',
            a: '同一分组下有多条上游线路时，网关会把请求自动切换到其他可用的线路，不需要你修改任何配置。'
          },
          limits: {
            q: '可以限制某把密钥的用量吗？',
            a: '可以。每把密钥都能单独设置额度和速率上限，也可以随时停用或删除。'
          }
        }
      },
      cta: {
        title: '现在开始，一个密钥就够了',
        description: '注册后创建密钥，即可调用全部已接入的模型。'
      },
      footer: {
        tagline: '大模型 API 中转服务'
      }
    },
    footer: {
      allRightsReserved: '保留所有权利。'
    }
  },

  // Key Usage Query Page
  keyUsage: {
    title: 'API Key 用量查询',
    subtitle: '输入您的 API Key 以查看实时消费金额与使用状态',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: '查询',
    querying: '查询中...',
    privacyNote: '您的 Key 仅在浏览器本地处理，不会被存储',
    dateRange: '统计范围:',
    dateRangeToday: '今日',
    dateRange7d: '7 天',
    dateRange30d: '30 天',
    dateRange90d: '90 天',
    dateRangeCustom: '自定义',
    apply: '应用',
    used: '已使用',
    detailInfo: '详细信息',
    tokenStats: 'Token 统计',
    dailyDetail: '按日明细',
    modelStats: '模型用量统计',
    // Table headers
    date: '日期',
    model: '模型',
    requests: '请求数',
    inputTokens: '输入 Tokens',
    outputTokens: '输出 Tokens',
    cacheCreationTokens: '缓存创建',
    cacheReadTokens: '缓存读取',
    cacheWriteTokens: '缓存写入',
    totalTokens: '总 Tokens',
    cost: '费用',
    // Status
    quotaMode: 'Key 限额模式',
    walletBalance: '钱包余额',
    // Ring card titles
    totalQuota: '总额度',
    limit5h: '5 小时限额',
    limitDaily: '日限额',
    limit7d: '7 天限额',
    limitWeekly: '周限额',
    limitMonthly: '月限额',
    // Detail rows
    remainingQuota: '剩余额度',
    expiresAt: '过期时间',
    todayExpires: '(今日到期)',
    daysLeft: '({days} 天)',
    usedQuota: '已用额度',
    resetNow: '即将重置',
    subscriptionType: '订阅类型',
    billingType: '计费方式',
    subscriptionExpires: '订阅到期',
    // Usage stat cells
    todayRequests: '今日请求',
    todayInputTokens: '今日输入',
    todayOutputTokens: '今日输出',
    todayTokens: '今日 Tokens',
    todayCacheCreation: '今日缓存创建',
    todayCacheRead: '今日缓存读取',
    todayCost: '今日费用',
    rpmTpm: 'RPM / TPM',
    totalRequests: '累计请求',
    totalInputTokens: '累计输入',
    totalOutputTokens: '累计输出',
    totalTokensLabel: '累计 Tokens',
    totalCacheCreation: '累计缓存创建',
    totalCacheRead: '累计缓存读取',
    totalCost: '累计费用',
    avgDuration: '平均耗时',
    // Messages
    enterApiKey: '请输入 API Key',
    querySuccess: '查询成功',
    queryFailed: '查询失败',
    queryFailedRetry: '查询失败，请稍后重试',
    noDailyUsage: '暂无按日用量数据',
  },

  // Setup Wizard
  setup: {
    title: 'token 安装向导',
    description: '配置您的 token 实例',
    database: {
      title: '数据库配置',
      description: '连接到您的 PostgreSQL 数据库',
      host: '主机',
      port: '端口',
      username: '用户名',
      password: '密码',
      databaseName: '数据库名称',
      sslMode: 'SSL 模式',
      passwordPlaceholder: '密码',
      ssl: {
        disable: '禁用',
        require: '要求',
        verifyCa: '验证 CA',
        verifyFull: '完全验证'
      }
    },
    redis: {
      title: 'Redis 配置',
      description: '连接到您的 Redis 服务器',
      host: '主机',
      port: '端口',
      username: '用户名（可选）',
      password: '密码（可选）',
      database: '数据库',
      usernamePlaceholder: '默认用户留空',
      passwordPlaceholder: '密码',
      enableTls: '启用 TLS',
      enableTlsHint: '连接 Redis 时使用 TLS（公共 CA 证书）'
    },
    admin: {
      title: '管理员账户',
      description: '创建您的管理员账户',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      passwordPlaceholder: '至少 8 个字符',
      confirmPasswordPlaceholder: '确认密码',
      passwordMismatch: '密码不匹配'
    },
    ready: {
      title: '准备安装',
      description: '检查您的配置并完成安装',
      database: '数据库',
      redis: 'Redis',
      adminEmail: '管理员邮箱'
    },
    status: {
      testing: '测试中...',
      success: '连接成功',
      testConnection: '测试连接',
      installing: '安装中...',
      completeInstallation: '完成安装',
      completed: '安装完成！',
      redirecting: '正在跳转到登录页面...',
      restarting: '服务正在重启，请稍候...',
      timeout: '服务重启时间超出预期，请手动刷新页面。'
    }
  },

  // Common
}
