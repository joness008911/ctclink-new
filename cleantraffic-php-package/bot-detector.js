/**
 * CleanTraffic Advanced Behavioral Bot Detection
 * Phase 2: Client-side behavioral analysis
 * Detects bot patterns through user interaction monitoring
 */

class CleanTrafficBotDetector {
    constructor() {
        this.behaviorData = {
            mouseMovements: [],
            keystrokes: [],
            scrollEvents: [],
            clickEvents: [],
            touchEvents: [],
            browserFingerprint: {},
            timingData: {
                pageLoadTime: Date.now(),
                firstInteraction: null,
                totalInteractions: 0
            },
            suspiciousActivities: []
        };
        
        this.botScore = 0;
        this.isBot = false;
        this.detectionComplete = false;
        
        this.init();
    }

    init() {
        this.generateBrowserFingerprint();
        this.setupEventListeners();
        this.createHoneypots();
        this.startDetection();
    }

    // Generate unique browser fingerprint
    generateBrowserFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('CleanTraffic Bot Detection', 2, 2);
        
        this.behaviorData.browserFingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth
            },
            window: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight
            },
            canvasFingerprint: canvas.toDataURL(),
            webgl: this.getWebGLFingerprint(),
            plugins: Array.from(navigator.plugins).map(p => p.name),
            webdriver: navigator.webdriver,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
    }

    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return null;
            
            return {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
            };
        } catch (e) {
            return null;
        }
    }

    setupEventListeners() {
        // Mouse movement tracking
        document.addEventListener('mousemove', (e) => {
            const movement = {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                deltaX: e.movementX || 0,
                deltaY: e.movementY || 0
            };
            
            this.behaviorData.mouseMovements.push(movement);
            this.recordInteraction('mousemove');
            
            // Keep only last 100 movements for performance
            if (this.behaviorData.mouseMovements.length > 100) {
                this.behaviorData.mouseMovements.shift();
            }
        });

        // Keystroke pattern detection
        document.addEventListener('keydown', (e) => {
            const keystroke = {
                key: e.key,
                timestamp: Date.now(),
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
            };
            
            this.behaviorData.keystrokes.push(keystroke);
            this.recordInteraction('keydown');
            
            // Detect rapid typing (potential bot)
            if (this.behaviorData.keystrokes.length >= 2) {
                const lastTwo = this.behaviorData.keystrokes.slice(-2);
                const timeDiff = lastTwo[1].timestamp - lastTwo[0].timestamp;
                
                if (timeDiff < 50) { // Less than 50ms between keystrokes
                    this.behaviorData.suspiciousActivities.push({
                        type: 'rapid_typing',
                        timestamp: Date.now(),
                        timeDiff: timeDiff
                    });
                }
            }
        });

        // Scroll behavior monitoring
        document.addEventListener('scroll', (e) => {
            const scrollEvent = {
                scrollTop: window.pageYOffset || document.documentElement.scrollTop,
                timestamp: Date.now()
            };
            
            this.behaviorData.scrollEvents.push(scrollEvent);
            this.recordInteraction('scroll');
            
            // Keep only last 50 scroll events
            if (this.behaviorData.scrollEvents.length > 50) {
                this.behaviorData.scrollEvents.shift();
            }
        });

        // Click event tracking
        document.addEventListener('click', (e) => {
            const clickEvent = {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now(),
                target: e.target.tagName,
                button: e.button
            };
            
            this.behaviorData.clickEvents.push(clickEvent);
            this.recordInteraction('click');
        });

        // Touch event tracking (mobile detection)
        document.addEventListener('touchstart', (e) => {
            const touchEvent = {
                touches: e.touches.length,
                timestamp: Date.now()
            };
            
            this.behaviorData.touchEvents.push(touchEvent);
            this.recordInteraction('touch');
        });
    }

    createHoneypots() {
        // Create invisible input fields that bots might fill
        const honeypots = [
            { name: 'email_confirm', type: 'email' },
            { name: 'username_verify', type: 'text' },
            { name: 'security_check', type: 'hidden' },
            { name: 'bot_trap', type: 'text' }
        ];

        honeypots.forEach(field => {
            const input = document.createElement('input');
            input.type = field.type;
            input.name = field.name;
            input.style.position = 'absolute';
            input.style.left = '-9999px';
            input.style.top = '-9999px';
            input.style.width = '1px';
            input.style.height = '1px';
            input.style.opacity = '0';
            input.tabIndex = -1;
            input.autocomplete = 'off';
            
            // Monitor if bot fills honeypot
            input.addEventListener('input', () => {
                this.behaviorData.suspiciousActivities.push({
                    type: 'honeypot_filled',
                    field: field.name,
                    timestamp: Date.now()
                });
            });
            
            document.body.appendChild(input);
        });
    }

    recordInteraction(type) {
        this.behaviorData.timingData.totalInteractions++;
        
        if (!this.behaviorData.timingData.firstInteraction) {
            this.behaviorData.timingData.firstInteraction = Date.now();
        }
    }

    startDetection() {
        // Run analysis after 3 seconds of page activity
        setTimeout(() => {
            this.analyzeBehavior();
        }, 3000);
    }

    analyzeBehavior() {
        let suspicionScore = 0;
        const analysis = {
            mouseAnalysis: this.analyzeMouseBehavior(),
            keystrokeAnalysis: this.analyzeKeystrokeBehavior(),
            scrollAnalysis: this.analyzeScrollBehavior(),
            interactionAnalysis: this.analyzeInteractionPatterns(),
            browserAnalysis: this.analyzeBrowserFingerprint(),
            honeypotAnalysis: this.analyzeHoneypots()
        };

        // Calculate composite bot score
        suspicionScore += analysis.mouseAnalysis.score;
        suspicionScore += analysis.keystrokeAnalysis.score;
        suspicionScore += analysis.scrollAnalysis.score;
        suspicionScore += analysis.interactionAnalysis.score;
        suspicionScore += analysis.browserAnalysis.score;
        suspicionScore += analysis.honeypotAnalysis.score;

        this.botScore = Math.min(100, Math.max(0, suspicionScore));
        this.isBot = this.botScore > 70; // 70+ score indicates likely bot
        this.detectionComplete = true;

        // Store analysis results
        this.behaviorData.analysis = analysis;
        this.behaviorData.finalScore = this.botScore;
        this.behaviorData.isBot = this.isBot;
    }

    analyzeMouseBehavior() {
        const movements = this.behaviorData.mouseMovements;
        let score = 0;
        let reasons = [];

        if (movements.length === 0) {
            score += 30;
            reasons.push('No mouse movements detected');
        } else if (movements.length < 5) {
            score += 20;
            reasons.push('Very few mouse movements');
        } else {
            // Analyze movement patterns
            let straightLines = 0;
            let perfectCurves = 0;
            
            for (let i = 2; i < movements.length; i++) {
                const curr = movements[i];
                const prev = movements[i-1];
                const prevPrev = movements[i-2];
                
                // Check for perfect straight lines
                const slope1 = (prev.y - prevPrev.y) / (prev.x - prevPrev.x);
                const slope2 = (curr.y - prev.y) / (curr.x - prev.x);
                
                if (Math.abs(slope1 - slope2) < 0.1) {
                    straightLines++;
                }
                
                // Check for instant jumps
                const distance = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
                if (distance > 200) {
                    score += 5;
                    reasons.push('Large mouse jump detected');
                }
            }
            
            if (straightLines > movements.length * 0.8) {
                score += 25;
                reasons.push('Too many straight line movements');
            }
        }

        return { score, reasons };
    }

    analyzeKeystrokeBehavior() {
        const keystrokes = this.behaviorData.keystrokes;
        let score = 0;
        let reasons = [];

        if (keystrokes.length === 0) {
            return { score: 0, reasons: ['No keyboard activity'] };
        }

        // Check for rapid/robotic typing
        const rapidTyping = this.behaviorData.suspiciousActivities.filter(a => a.type === 'rapid_typing');
        if (rapidTyping.length > 3) {
            score += 30;
            reasons.push('Robotic typing pattern detected');
        }

        // Check for consistent timing patterns
        if (keystrokes.length >= 10) {
            const intervals = [];
            for (let i = 1; i < keystrokes.length; i++) {
                intervals.push(keystrokes[i].timestamp - keystrokes[i-1].timestamp);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, interval) => {
                return sum + Math.pow(interval - avgInterval, 2);
            }, 0) / intervals.length;
            
            if (variance < 100) { // Very consistent timing
                score += 20;
                reasons.push('Unnaturally consistent typing rhythm');
            }
        }

        return { score, reasons };
    }

    analyzeScrollBehavior() {
        const scrollEvents = this.behaviorData.scrollEvents;
        let score = 0;
        let reasons = [];

        if (scrollEvents.length === 0) {
            return { score: 5, reasons: ['No scroll activity'] };
        }

        // Check for instant large scrolls
        for (let i = 1; i < scrollEvents.length; i++) {
            const scrollDiff = Math.abs(scrollEvents[i].scrollTop - scrollEvents[i-1].scrollTop);
            const timeDiff = scrollEvents[i].timestamp - scrollEvents[i-1].timestamp;
            
            if (scrollDiff > 500 && timeDiff < 100) {
                score += 10;
                reasons.push('Instant large scroll detected');
            }
        }

        return { score, reasons };
    }

    analyzeInteractionPatterns() {
        const timingData = this.behaviorData.timingData;
        let score = 0;
        let reasons = [];

        // Check time to first interaction
        if (timingData.firstInteraction) {
            const timeToFirstInteraction = timingData.firstInteraction - timingData.pageLoadTime;
            
            if (timeToFirstInteraction < 100) {
                score += 20;
                reasons.push('Suspiciously fast first interaction');
            }
        } else {
            score += 15;
            reasons.push('No user interactions detected');
        }

        // Check total interaction volume
        if (timingData.totalInteractions === 0) {
            score += 25;
            reasons.push('Zero user interactions');
        } else if (timingData.totalInteractions > 1000) {
            score += 15;
            reasons.push('Unusually high interaction count');
        }

        return { score, reasons };
    }

    analyzeBrowserFingerprint() {
        const fingerprint = this.behaviorData.browserFingerprint;
        let score = 0;
        let reasons = [];

        // Check for headless browser indicators
        if (fingerprint.webdriver) {
            score += 40;
            reasons.push('WebDriver detected');
        }

        // Check for suspicious user agent
        const ua = fingerprint.userAgent.toLowerCase();
        const suspiciousUA = ['headless', 'phantom', 'selenium', 'chrome-headless', 'chromium'];
        if (suspiciousUA.some(s => ua.includes(s))) {
            score += 30;
            reasons.push('Suspicious user agent');
        }

        // Check for missing features
        if (!fingerprint.languages || fingerprint.languages.length === 0) {
            score += 15;
            reasons.push('Missing language preferences');
        }

        if (fingerprint.plugins.length === 0) {
            score += 10;
            reasons.push('No browser plugins');
        }

        // Check for impossible combinations
        if (fingerprint.platform.includes('Win') && ua.includes('mac')) {
            score += 25;
            reasons.push('Inconsistent platform/user agent');
        }

        return { score, reasons };
    }

    analyzeHoneypots() {
        const honeypotActivities = this.behaviorData.suspiciousActivities.filter(a => a.type === 'honeypot_filled');
        let score = 0;
        let reasons = [];

        if (honeypotActivities.length > 0) {
            score += 50; // Major red flag
            reasons.push(`Honeypot fields filled: ${honeypotActivities.length}`);
        }

        return { score, reasons };
    }

    // Get detection results
    getResults() {
        return {
            isBot: this.isBot,
            botScore: this.botScore,
            detectionComplete: this.detectionComplete,
            behaviorData: this.behaviorData,
            timestamp: Date.now()
        };
    }

    // Get compact data for API submission
    getCompactData() {
        return {
            botScore: this.botScore,
            isBot: this.isBot,
            mouseMovements: this.behaviorData.mouseMovements.length,
            keystrokes: this.behaviorData.keystrokes.length,
            scrollEvents: this.behaviorData.scrollEvents.length,
            totalInteractions: this.behaviorData.timingData.totalInteractions,
            suspiciousActivities: this.behaviorData.suspiciousActivities.length,
            browserFingerprint: {
                userAgent: this.behaviorData.browserFingerprint.userAgent,
                platform: this.behaviorData.browserFingerprint.platform,
                webdriver: this.behaviorData.browserFingerprint.webdriver,
                screen: this.behaviorData.browserFingerprint.screen,
                timezone: this.behaviorData.browserFingerprint.timezone
            }
        };
    }
}

// Auto-initialize when script loads
window.CleanTrafficBotDetector = CleanTrafficBotDetector;

// Global instance for easy access
window.botDetector = new CleanTrafficBotDetector();

console.log('🛡️ CleanTraffic Bot Detector initialized');