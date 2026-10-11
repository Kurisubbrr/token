export default {
  batchImageGuide: {
    title: 'Batch Image Generation',
    description: 'Submit multiple prompts in one job and download the generated images when complete'
  },
  // Home Page
  home: {
    backToHome: 'Back to home',
    viewOnGithub: 'View on GitHub',
    viewDocs: 'View Documentation',
    docs: 'Docs',
    switchToLight: 'Switch to Light Mode',
    switchToDark: 'Switch to Dark Mode',
    dashboard: 'Dashboard',
    login: 'Login',
    getStarted: 'Get Started',
    goToDashboard: 'Go to Dashboard',
    // User-focused value proposition
    heroSubtitle: 'One Key, All AI Models',
    heroDescription: 'No need to manage multiple subscriptions. Access Claude, GPT, Gemini and more with a single API key',
    tags: {
      subscriptionToApi: 'Subscription to API',
      stickySession: 'Session Persistence',
      realtimeBilling: 'Pay As You Go'
    },
    // Pain points section
    painPoints: {
      title: 'Sound Familiar?',
      items: {
        expensive: {
          title: 'High Subscription Costs',
          desc: 'Paying for multiple AI subscriptions that add up every month'
        },
        complex: {
          title: 'Account Chaos',
          desc: 'Managing scattered accounts and API keys across different platforms'
        },
        unstable: {
          title: 'Service Interruptions',
          desc: 'Single accounts hitting rate limits and disrupting your workflow'
        },
        noControl: {
          title: 'No Usage Control',
          desc: "Can't track where your money goes or limit team member usage"
        }
      }
    },
    // Solutions section
    solutions: {
      title: 'We Solve These Problems',
      subtitle: 'Three simple steps to stress-free AI access'
    },
    features: {
      unifiedGateway: 'One-Click Access',
      unifiedGatewayDesc: 'Get a single API key to call all connected AI models. No separate applications needed.',
      multiAccount: 'Always Reliable',
      multiAccountDesc: 'Smart routing across multiple upstream accounts with automatic failover. Say goodbye to errors.',
      balanceQuota: 'Pay What You Use',
      balanceQuotaDesc: 'Usage-based billing with quota limits. Full visibility into team consumption.'
    },
    // Comparison section
    comparison: {
      title: 'Why Choose Us?',
      headers: {
        feature: 'Comparison',
        official: 'Official Subscriptions',
        us: 'Our Platform'
      },
      items: {
        pricing: {
          feature: 'Pricing',
          official: 'Fixed monthly fee, pay even if unused',
          us: 'Pay only for what you use'
        },
        models: {
          feature: 'Model Selection',
          official: 'Single provider only',
          us: 'Switch between models freely'
        },
        management: {
          feature: 'Account Management',
          official: 'Manage each service separately',
          us: 'Unified key, one dashboard'
        },
        stability: {
          feature: 'Stability',
          official: 'Single account rate limits',
          us: 'Multi-account pool, auto-failover'
        },
        control: {
          feature: 'Usage Control',
          official: 'Not available',
          us: 'Quotas & detailed analytics'
        }
      }
    },
    providers: {
      title: 'Supported AI Models',
      description: 'One API, Multiple Choices',
      supported: 'Supported',
      soon: 'Soon',
      claude: 'Claude',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      more: 'More'
    },
    // CTA section
    cta: {
      title: 'Ready to Get Started?',
      description: 'Sign up now and get free trial credits to experience seamless AI access',
      button: 'Sign Up Free'
    },
    // Landing page
    landing: {
      nav: {
        usage: 'Usage lookup'
      },
      hero: {
        badge: 'LLM API gateway',
        tagline: 'One key for every model',
        description: 'Claude, GPT, Gemini, DeepSeek and more behind a single endpoint. Works with the official protocols and SDKs — change one line, the Base URL.',
        browseModels: 'Browse models',
        howToConnect: 'See how to connect'
      },
      console: {
        request: 'Request',
        response: 'Response',
        composing: 'Composing',
        routing: 'Routing',
        streaming: 'Streaming',
        waiting: 'Waiting for response',
        client: 'Your app',
        input: 'in',
        output: 'out',
        prompt: 'Introduce yourself in one sentence.',
        replies: {
          claude: 'I am Claude, an AI assistant trained by Anthropic. I am good at writing, analysis and code, and I like making hard things clear.',
          gpt: 'I am GPT, a large language model trained by OpenAI. I can help you write, code, translate, or think a problem through.',
          gemini: 'I am Gemini, a multimodal model trained by Google. I can read text, images and code and give you a structured answer.',
          deepseek: 'I am DeepSeek, a large model built by DeepSeek. I am strong at step-by-step reasoning and code generation.'
        }
      },
      providers: {
        title: 'Leading models, one place'
      },
      features: {
        eyebrow: 'Capabilities',
        title: 'The gateway takes the complexity. You keep it simple.',
        description: 'Accounts, routing and billing are handled for you. All you need is one key and one endpoint.',
        demo: 'Demo',
        oneKey: {
          title: 'One key, every model',
          desc: 'No separate sign-ups, top-ups or keys for each vendor. Switching models is a one-parameter change.',
          hint: 'Click any model to send a call with the same key',
          yourKey: 'Your key',
          log: 'Call log'
        },
        routing: {
          title: 'Smart routing with failover',
          desc: 'Several upstream routes stand by at once. When one is rate limited or fails, requests move to a healthy route automatically.',
          hint: 'Click any route to simulate a failure',
          upstream: 'Upstream',
          log: 'Routing log',
          evDown: '{name} returned 429, taken out of rotation',
          evSwitch: 'Traffic switched to {name}',
          evUp: '{name} recovered, back in rotation',
          evBlocked: 'No route available, requests are queued'
        },
        billing: {
          title: 'Pay as you go, fully itemized',
          desc: 'You are billed for the tokens you actually use, and every call is itemized.',
          hint: 'Click any row to see how the cost breaks down',
          today: 'Spend today',
          sample: 'Sample data',
          input: 'Input',
          output: 'Output',
          cache: 'Cache hits'
        },
        compat: {
          title: 'Works with official protocols and SDKs',
          desc: 'Native support for the Anthropic, OpenAI and Gemini API formats. Existing code and tools migrate by changing the endpoint.',
          terminal: 'Terminal',
          connected: 'Connected to {name}'
        },
        stream: {
          title: 'Streaming passthrough',
          desc: 'Responses are relayed as SSE unchanged, so you see each token as the model produces it.'
        },
        sticky: {
          title: 'Sticky sessions',
          desc: 'A conversation stays on the same route, so prompt caching keeps working.'
        },
        quota: {
          title: 'Quotas under control',
          desc: 'Set spend and rate limits per key, and see team usage at a glance.'
        }
      },
      quickstart: {
        eyebrow: 'Quickstart',
        title: 'Three steps, live in minutes',
        steps: {
          signup: {
            title: 'Sign up and sign in',
            desc: 'Create an account and open the console.'
          },
          key: {
            title: 'Create an API key',
            desc: 'Pick a group and generate your key.'
          },
          call: {
            title: 'Swap the Base URL',
            desc: 'Point your requests at this site. The rest of your code stays the same.'
          }
        },
        hello: 'Hello',
        copy: 'Copy',
        copied: 'Copied'
      },
      pricing: {
        eyebrow: 'Pricing',
        title: 'Pay for what you use',
        lead: 'Billed by token usage. The formula fits on one line, and every call is on record.',
        formula: {
          price: 'Model price',
          rate: 'Group rate',
          usage: 'Tokens used',
          cost: 'Cost'
        },
        model: 'Model',
        input: 'Input',
        output: 'Output',
        unit: 'USD per million tokens, group rate applied',
        viewAll: 'View all {count} models',
        facts: {
          token: {
            title: 'Billed per token',
            desc: 'Each call is priced by its input, output and cached tokens. You pay for exactly what you use.'
          },
          rate: {
            title: 'Group rates',
            desc: 'Each group has its own rate multiplier. What you pay is the model price times your group rate.'
          },
          records: {
            title: 'Itemized records',
            desc: 'Token usage and cost for every call are kept in your usage records, ready to check at any time.'
          }
        }
      },
      faq: {
        eyebrow: 'FAQ',
        title: 'Things you may want to know first',
        lead: 'Still have questions? Sign in to find announcements and docs in the console.',
        items: {
          what: {
            q: 'What is {siteName}?',
            a: 'An API relay for large language models. Sign up, create one key, and call every connected model through the same endpoint, without managing an account with each provider.'
          },
          connect: {
            q: 'How do I connect my existing tools and code?',
            a: 'The API is compatible with the native Anthropic Messages, OpenAI Chat Completions / Responses and Gemini protocols. Point the Base URL in the official SDK or client at this site and use your key. Nothing else changes.'
          },
          models: {
            q: 'Which models are supported?',
            a: 'Whatever is connected in the back end. After signing in, the console lists the groups and models currently available to you.'
          },
          billing: {
            q: 'How is usage billed?',
            a: 'By token usage. What you pay is the model price times your group rate, and the usage and cost of every call appear in your usage records.'
          },
          failover: {
            q: 'What happens if an upstream line fails?',
            a: 'When a group has several upstream lines, the gateway automatically moves requests to another available line. You do not need to change any configuration.'
          },
          limits: {
            q: 'Can I limit how much a key can use?',
            a: 'Yes. Each key can have its own quota and rate limit, and you can disable or delete it at any time.'
          }
        }
      },
      cta: {
        title: 'Start now. One key is all you need.',
        description: 'Sign up, create a key, and call every model that is connected.'
      },
      footer: {
        tagline: 'LLM API gateway'
      }
    },
    footer: {
      allRightsReserved: 'All rights reserved.'
    }
  },

  // Key Usage Query Page
  keyUsage: {
    title: 'API Key Usage',
    subtitle: 'Enter your API Key to view real-time spending and usage status',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: 'Query',
    querying: 'Querying...',
    privacyNote: 'Your Key is processed locally in the browser and will not be stored',
    dateRange: 'Date Range:',
    dateRangeToday: 'Today',
    dateRange7d: '7 Days',
    dateRange30d: '30 Days',
    dateRange90d: '90 Days',
    dateRangeCustom: 'Custom',
    apply: 'Apply',
    used: 'Used',
    detailInfo: 'Detail Information',
    tokenStats: 'Token Statistics',
    dailyDetail: 'Daily Detail',
    modelStats: 'Model Usage Statistics',
    // Table headers
    date: 'Date',
    model: 'Model',
    requests: 'Requests',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    cacheCreationTokens: 'Cache Creation',
    cacheReadTokens: 'Cache Read',
    cacheWriteTokens: 'Cache Write',
    totalTokens: 'Total Tokens',
    cost: 'Cost',
    // Status
    quotaMode: 'Key Quota Mode',
    walletBalance: 'Wallet Balance',
    // Ring card titles
    totalQuota: 'Total Quota',
    limit5h: '5-Hour Limit',
    limitDaily: 'Daily Limit',
    limit7d: '7-Day Limit',
    limitWeekly: 'Weekly Limit',
    limitMonthly: 'Monthly Limit',
    // Detail rows
    remainingQuota: 'Remaining Quota',
    expiresAt: 'Expires At',
    todayExpires: '(expires today)',
    daysLeft: '({days} days)',
    usedQuota: 'Used Quota',
    resetNow: 'Resetting soon',
    subscriptionType: 'Subscription Type',
    billingType: 'Billing Type',
    subscriptionExpires: 'Subscription Expires',
    // Usage stat cells
    todayRequests: 'Today Requests',
    todayInputTokens: 'Today Input',
    todayOutputTokens: 'Today Output',
    todayTokens: 'Today Tokens',
    todayCacheCreation: 'Today Cache Creation',
    todayCacheRead: 'Today Cache Read',
    todayCost: 'Today Cost',
    rpmTpm: 'RPM / TPM',
    totalRequests: 'Total Requests',
    totalInputTokens: 'Total Input',
    totalOutputTokens: 'Total Output',
    totalTokensLabel: 'Total Tokens',
    totalCacheCreation: 'Total Cache Creation',
    totalCacheRead: 'Total Cache Read',
    totalCost: 'Total Cost',
    avgDuration: 'Avg Duration',
    // Messages
    enterApiKey: 'Please enter an API Key',
    querySuccess: 'Query successful',
    queryFailed: 'Query failed',
    queryFailedRetry: 'Query failed, please try again later',
    noDailyUsage: 'No daily usage data',
  },

  // Setup Wizard
  setup: {
    title: 'token Setup',
    description: 'Configure your token instance',
    database: {
      title: 'Database Configuration',
      description: 'Connect to your PostgreSQL database',
      host: 'Host',
      port: 'Port',
      username: 'Username',
      password: 'Password',
      databaseName: 'Database Name',
      sslMode: 'SSL Mode',
      passwordPlaceholder: 'Password',
      ssl: {
        disable: 'Disable',
        require: 'Require',
        verifyCa: 'Verify CA',
        verifyFull: 'Verify Full'
      }
    },
    redis: {
      title: 'Redis Configuration',
      description: 'Connect to your Redis server',
      host: 'Host',
      port: 'Port',
      username: 'Username (optional)',
      password: 'Password (optional)',
      database: 'Database',
      usernamePlaceholder: 'Leave empty for default user',
      passwordPlaceholder: 'Password',
      enableTls: 'Enable TLS',
      enableTlsHint: 'Use TLS when connecting to Redis (public CA certs)'
    },
    admin: {
      title: 'Admin Account',
      description: 'Create your administrator account',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      passwordPlaceholder: 'Min 8 characters',
      confirmPasswordPlaceholder: 'Confirm password',
      passwordMismatch: 'Passwords do not match'
    },
    ready: {
      title: 'Ready to Install',
      description: 'Review your configuration and complete setup',
      database: 'Database',
      redis: 'Redis',
      adminEmail: 'Admin Email'
    },
    status: {
      testing: 'Testing...',
      success: 'Connection Successful',
      testConnection: 'Test Connection',
      installing: 'Installing...',
      completeInstallation: 'Complete Installation',
      completed: 'Installation completed!',
      redirecting: 'Redirecting to login page...',
      restarting: 'Service is restarting, please wait...',
      timeout: 'Service restart is taking longer than expected. Please refresh the page manually.'
    }
  },

  // Common
}
