module.exports = {
    apps: [{
        name: 'invpatrimonio-api',
        script: './src/index.js',
        instances: 'max', // Use all available CPU cores
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'development',
            PORT: 3001
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3001
        },
        
        // Performance and monitoring
        max_memory_restart: '1G',
        min_uptime: '10s',
        max_restarts: 10,
        
        // Logging
        log_file: './logs/combined.log',
        out_file: './logs/out.log',
        error_file: './logs/error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        
        // Auto-restart on file changes (development)
        watch: false,
        ignore_watch: [
            'node_modules',
            'logs',
            'uploads'
        ],
        
        // Health monitoring
        health_check_grace_period: 3000,
        health_check_fatal_exceptions: true,
        
        // Environment specific settings
        node_args: process.env.NODE_ENV === 'production' ? 
            ['--max-old-space-size=2048'] : 
            ['--max-old-space-size=1024', '--inspect=0.0.0.0:9229']
    }],

    deploy: {
        production: {
            user: 'root',
            host: '31.97.210.189',
            ref: 'origin/main',
            repo: 'https://github.com/OliverHuron/InvPatrimonio.git',
            path: '/var/www/invpatrimonio',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};