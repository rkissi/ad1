// Multi-Environment Configuration System
// Supports mock, testnet, and mainnet modes with seamless switching

export type Environment = 'mock' | 'testnet' | 'mainnet' | 'development';

export interface EnvironmentConfig {
  name: Environment;
  blockchain: {
    enabled: boolean;
    rpcUrl: string;
    networkId: number;
    gasPrice?: string;
    gasLimit?: number;
    confirmations: number;
    contracts: {
      marketplace: string;
      token: string;
    };
  };
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    database: number;
  };
  api: {
    baseUrl: string;
    port: number;
    corsOrigins: string[];
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };
  features: {
    fraudPrevention: boolean;
    realTimeAnalytics: boolean;
    automatedPayouts: boolean;
    consentManagement: boolean;
    mockData: boolean;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
    hashRounds: number;
  };
  monitoring: {
    enabled: boolean;
    metricsPort: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  mock: {
    name: 'mock',
    blockchain: {
      enabled: false,
      rpcUrl: 'http://localhost:8545',
      networkId: 31337,
      confirmations: 1,
      contracts: {
        marketplace: '0x0000000000000000000000000000000000000000',
        token: '0x0000000000000000000000000000000000000000'
      }
    },
    database: {
      host: 'localhost',
      port: 5432,
      database: 'metaverse_ads_mock',
      username: 'postgres',
      password: 'password',
      ssl: false
    },
    redis: {
      host: 'localhost',
      port: 6379,
      database: 0
    },
    api: {
      baseUrl: 'http://localhost:3001',
      port: 3001,
      corsOrigins: ['http://localhost:5173', 'http://localhost:3000'],
      rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 1000 // Very permissive for development
      }
    },
    features: {
      fraudPrevention: false,
      realTimeAnalytics: true,
      automatedPayouts: false,
      consentManagement: false,
      mockData: true
    },
    security: {
      jwtSecret: 'mock-jwt-secret-not-for-production',
      encryptionKey: 'mock-encryption-key-32-characters',
      hashRounds: 8 // Faster for development
    },
    monitoring: {
      enabled: false,
      metricsPort: 9090,
      logLevel: 'debug'
    }
  },

  development: {
    name: 'development',
    blockchain: {
      enabled: true,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
      networkId: 31337,
      gasPrice: '20000000000', // 20 gwei
      gasLimit: 8000000,
      confirmations: 1,
      contracts: {
        marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        token: process.env.TOKEN_CONTRACT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
      }
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'metaverse_ads_dev',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: false
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0')
    },
    api: {
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
      port: parseInt(process.env.PORT || '3001'),
      corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
      rateLimiting: {
        windowMs: 60000,
        maxRequests: 500
      }
    },
    features: {
      fraudPrevention: true,
      realTimeAnalytics: true,
      automatedPayouts: true,
      consentManagement: true,
      mockData: false
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
      encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-characters!',
      hashRounds: 12
    },
    monitoring: {
      enabled: true,
      metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
      logLevel: 'debug'
    }
  },

  testnet: {
    name: 'testnet',
    blockchain: {
      enabled: true,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://goerli.infura.io/v3/YOUR_PROJECT_ID',
      networkId: 5, // Goerli
      gasPrice: '30000000000', // 30 gwei
      gasLimit: 8000000,
      confirmations: 2,
      contracts: {
        marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS || '',
        token: process.env.TOKEN_CONTRACT_ADDRESS || ''
      }
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'metaverse_ads_testnet',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: true
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '1')
    },
    api: {
      baseUrl: process.env.API_BASE_URL || 'https://api-testnet.metaverseads.com',
      port: parseInt(process.env.PORT || '3001'),
      corsOrigins: (process.env.CORS_ORIGINS || 'https://testnet.metaverseads.com').split(','),
      rateLimiting: {
        windowMs: 60000,
        maxRequests: 200
      }
    },
    features: {
      fraudPrevention: true,
      realTimeAnalytics: true,
      automatedPayouts: true,
      consentManagement: true,
      mockData: false
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      hashRounds: 12
    },
    monitoring: {
      enabled: true,
      metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
      logLevel: 'info'
    }
  },

  mainnet: {
    name: 'mainnet',
    blockchain: {
      enabled: true,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      networkId: 1, // Ethereum Mainnet
      gasPrice: '50000000000', // 50 gwei
      gasLimit: 8000000,
      confirmations: 3,
      contracts: {
        marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS || '',
        token: process.env.TOKEN_CONTRACT_ADDRESS || ''
      }
    },
    database: {
      host: process.env.DB_HOST || '',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'metaverse_ads_prod',
      username: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      ssl: true
    },
    redis: {
      host: process.env.REDIS_HOST || '',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      database: parseInt(process.env.REDIS_DB || '0')
    },
    api: {
      baseUrl: process.env.API_BASE_URL || 'https://api.metaverseads.com',
      port: parseInt(process.env.PORT || '3001'),
      corsOrigins: (process.env.CORS_ORIGINS || 'https://metaverseads.com').split(','),
      rateLimiting: {
        windowMs: 60000,
        maxRequests: 100
      }
    },
    features: {
      fraudPrevention: true,
      realTimeAnalytics: true,
      automatedPayouts: true,
      consentManagement: true,
      mockData: false
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      hashRounds: 14
    },
    monitoring: {
      enabled: true,
      metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
      logLevel: 'warn'
    }
  }
};

export class EnvironmentManager {
  private currentEnvironment: Environment;
  private config: EnvironmentConfig;

  constructor(environment?: Environment) {
    this.currentEnvironment = environment || this.detectEnvironment();
    this.config = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    this.validateConfig();
  }

  private detectEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV;
    const explicitEnv = process.env.METAVERSE_ENV as Environment;

    if (explicitEnv && ENVIRONMENT_CONFIGS[explicitEnv]) {
      return explicitEnv;
    }

    switch (nodeEnv) {
      case 'production':
        return 'mainnet';
      case 'test':
        return 'testnet';
      case 'development':
        return 'development';
      default:
        return 'mock';
    }
  }

  private validateConfig(): void {
    const config = this.config;
    const errors: string[] = [];

    // Validate required fields for non-mock environments
    if (config.name !== 'mock') {
      if (config.blockchain.enabled) {
        if (!config.blockchain.contracts.marketplace) {
          errors.push('Marketplace contract address is required');
        }
        if (!config.blockchain.contracts.token) {
          errors.push('Token contract address is required');
        }
      }

      if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
        errors.push('JWT secret must be at least 32 characters');
      }

      if (!config.security.encryptionKey || config.security.encryptionKey.length < 32) {
        errors.push('Encryption key must be at least 32 characters');
      }

      if (config.name === 'mainnet') {
        if (!config.database.password) {
          errors.push('Database password is required for production');
        }
        if (config.api.corsOrigins.includes('*')) {
          errors.push('Wildcard CORS origins not allowed in production');
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Environment configuration errors:\n${errors.join('\n')}`);
    }
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config }; // Return copy to prevent mutations
  }

  getCurrentEnvironment(): Environment {
    return this.currentEnvironment;
  }

  isProduction(): boolean {
    return this.currentEnvironment === 'mainnet';
  }

  isDevelopment(): boolean {
    return this.currentEnvironment === 'development' || this.currentEnvironment === 'mock';
  }

  isBlockchainEnabled(): boolean {
    return this.config.blockchain.enabled;
  }

  isMockMode(): boolean {
    return this.currentEnvironment === 'mock' || this.config.features.mockData;
  }

  getFeatureFlag(feature: keyof EnvironmentConfig['features']): boolean {
    return this.config.features[feature];
  }

  // Dynamic environment switching (for demos and testing)
  switchEnvironment(environment: Environment): void {
    if (!ENVIRONMENT_CONFIGS[environment]) {
      throw new Error(`Unknown environment: ${environment}`);
    }

    console.log(`🔄 Switching from ${this.currentEnvironment} to ${environment}`);
    
    this.currentEnvironment = environment;
    this.config = ENVIRONMENT_CONFIGS[environment];
    
    try {
      this.validateConfig();
      console.log(`✅ Successfully switched to ${environment} environment`);
    } catch (error) {
      console.warn(`⚠️ Environment validation warnings for ${environment}:`, error.message);
    }
  }

  // Get environment-specific service configurations
  getDatabaseConfig() {
    return this.config.database;
  }

  getRedisConfig() {
    return this.config.redis;
  }

  getBlockchainConfig() {
    return this.config.blockchain;
  }

  getApiConfig() {
    return this.config.api;
  }

  getSecurityConfig() {
    return this.config.security;
  }

  getMonitoringConfig() {
    return this.config.monitoring;
  }

  // Environment status and health checks
  async performHealthCheck(): Promise<{
    environment: Environment;
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      database: 'up' | 'down' | 'disabled';
      redis: 'up' | 'down' | 'disabled';
      blockchain: 'up' | 'down' | 'disabled';
    };
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const services = {
      database: 'disabled' as 'up' | 'down' | 'disabled',
      redis: 'disabled' as 'up' | 'down' | 'disabled',
      blockchain: 'disabled' as 'up' | 'down' | 'disabled'
    };

    // Check database connectivity
    try {
      // This would be implemented with actual database connection test
      services.database = 'up';
    } catch (error) {
      services.database = 'down';
      warnings.push(`Database connection failed: ${error.message}`);
    }

    // Check Redis connectivity
    try {
      // This would be implemented with actual Redis connection test
      services.redis = 'up';
    } catch (error) {
      services.redis = 'down';
      warnings.push(`Redis connection failed: ${error.message}`);
    }

    // Check blockchain connectivity
    if (this.config.blockchain.enabled) {
      try {
        // This would be implemented with actual blockchain connection test
        services.blockchain = 'up';
      } catch (error) {
        services.blockchain = 'down';
        warnings.push(`Blockchain connection failed: ${error.message}`);
      }
    }

    // Determine overall status
    const downServices = Object.values(services).filter(status => status === 'down').length;
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (downServices === 0) {
      status = 'healthy';
    } else if (downServices === 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      environment: this.currentEnvironment,
      status,
      services,
      warnings
    };
  }

  // Configuration export for external tools
  exportConfig(): string {
    const safeConfig = { ...this.config };
    
    // Remove sensitive information
    safeConfig.security = {
      ...safeConfig.security,
      jwtSecret: '[REDACTED]',
      encryptionKey: '[REDACTED]'
    };
    
    if (safeConfig.database.password) {
      safeConfig.database.password = '[REDACTED]';
    }
    
    if (safeConfig.redis.password) {
      safeConfig.redis.password = '[REDACTED]';
    }

    return JSON.stringify(safeConfig, null, 2);
  }

  // Environment comparison for migrations
  compareEnvironments(otherEnv: Environment): {
    differences: string[];
    compatible: boolean;
  } {
    const otherConfig = ENVIRONMENT_CONFIGS[otherEnv];
    const differences: string[] = [];

    // Compare blockchain networks
    if (this.config.blockchain.networkId !== otherConfig.blockchain.networkId) {
      differences.push(`Network ID: ${this.config.blockchain.networkId} vs ${otherConfig.blockchain.networkId}`);
    }

    // Compare feature flags
    Object.keys(this.config.features).forEach(feature => {
      if (this.config.features[feature] !== otherConfig.features[feature]) {
        differences.push(`Feature ${feature}: ${this.config.features[feature]} vs ${otherConfig.features[feature]}`);
      }
    });

    // Determine compatibility
    const compatible = differences.length === 0 || (
      this.currentEnvironment === 'mock' || otherEnv === 'mock'
    );

    return { differences, compatible };
  }
}

// Singleton instance
export const environmentManager = new EnvironmentManager();

// Convenience functions
export function getCurrentEnvironment(): Environment {
  return environmentManager.getCurrentEnvironment();
}

export function getConfig(): EnvironmentConfig {
  return environmentManager.getConfig();
}

export function isProduction(): boolean {
  return environmentManager.isProduction();
}

export function isDevelopment(): boolean {
  return environmentManager.isDevelopment();
}

export function isBlockchainEnabled(): boolean {
  return environmentManager.isBlockchainEnabled();
}

export function isMockMode(): boolean {
  return environmentManager.isMockMode();
}

export function getFeatureFlag(feature: keyof EnvironmentConfig['features']): boolean {
  return environmentManager.getFeatureFlag(feature);
}

// Environment-aware logger
export class EnvironmentLogger {
  private logLevel: string;

  constructor() {
    this.logLevel = environmentManager.getMonitoringConfig().logLevel;
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[${getCurrentEnvironment().toUpperCase()}] DEBUG:`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[${getCurrentEnvironment().toUpperCase()}] INFO:`, message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[${getCurrentEnvironment().toUpperCase()}] WARN:`, message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[${getCurrentEnvironment().toUpperCase()}] ERROR:`, message, ...args);
    }
  }
}

export const logger = new EnvironmentLogger();

export default EnvironmentManager;