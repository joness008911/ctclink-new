import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { Globe, TrendingUp, Bot, Users, MapPin, Calendar, BarChart3, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import type { Classification } from "@shared/schema";

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('7d');

  const { data: classifications = [] } = useQuery<Classification[]>({
    queryKey: ["/api/classifications?limit=1000"],
    refetchInterval: 10000,
  });

  // Color palette for charts
  const COLORS = {
    human: '#10b981', // green
    bot: '#ef4444', // red
    primary: '#3b82f6', // blue
    secondary: '#6b7280', // gray
    accent: '#8b5cf6' // purple
  };

  // Process data for geographic analysis
  const geoData = useMemo(() => {
    const countryMap = new Map();
    
    classifications.forEach(c => {
      if (c.country && c.country !== 'Unknown') {
        const key = c.country;
        const existing = countryMap.get(key) || { 
          country: c.country, 
          total: 0, 
          human: 0, 
          bot: 0,
          city: c.city || 'Unknown'
        };
        
        existing.total += 1;
        existing[c.visitorType.toLowerCase() as 'human' | 'bot'] += 1;
        countryMap.set(key, existing);
      }
    });
    
    return Array.from(countryMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 countries
  }, [classifications]);

  // Process data for ISP analysis
  const ispData = useMemo(() => {
    const ispMap = new Map();
    
    classifications.forEach(c => {
      if (c.isp && c.isp !== 'Unknown') {
        const key = c.isp;
        const existing = ispMap.get(key) || { 
          isp: c.isp, 
          total: 0, 
          human: 0, 
          bot: 0 
        };
        
        existing.total += 1;
        existing[c.visitorType.toLowerCase() as 'human' | 'bot'] += 1;
        ispMap.set(key, existing);
      }
    });
    
    return Array.from(ispMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // Top 8 ISPs
  }, [classifications]);

  // Process data for device/browser analysis
  const deviceData = useMemo(() => {
    const devices = classifications.reduce((acc: Record<string, number>, c) => {
      const device = c.deviceType || 'Unknown';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(devices).map(([device, count]) => ({
      device,
      count,
      percentage: Math.round((count / classifications.length) * 100)
    }));
  }, [classifications]);

  const browserData = useMemo(() => {
    const browsers = classifications.reduce((acc: Record<string, number>, c) => {
      const browser = c.browser || 'Unknown';
      acc[browser] = (acc[browser] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(browsers).map(([browser, count]) => ({
      browser,
      count,
      percentage: Math.round((count / classifications.length) * 100)
    }));
  }, [classifications]);

  // Process hourly traffic data
  const hourlyData = useMemo(() => {
    const hours = new Array(24).fill(0).map((_, i) => ({
      hour: i,
      human: 0,
      bot: 0,
      total: 0
    }));
    
    classifications.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hours[hour].total += 1;
      hours[hour][c.visitorType.toLowerCase() as 'human' | 'bot'] += 1;
    });
    
    return hours;
  }, [classifications]);

  // Calculate threat levels by country
  const threatLevels = useMemo(() => {
    return geoData.map(country => ({
      ...country,
      threatLevel: country.total > 0 ? Math.round((country.bot / country.total) * 100) : 0,
      riskCategory: country.bot / country.total > 0.7 ? 'High' : 
                   country.bot / country.total > 0.4 ? 'Medium' : 'Low'
    }));
  }, [geoData]);

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Advanced Analytics</h3>
          <p className="text-sm text-muted-foreground">Geographic bot traffic analysis and threat intelligence</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Geographic Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Globe className="mr-2 h-4 w-4 text-primary" />
              Geographic Traffic Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={geoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="country" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [value, name === 'human' ? 'Human' : 'Bot']}
                  labelFormatter={(label) => `Country: ${label}`}
                />
                <Bar dataKey="human" fill={COLORS.human} name="human" />
                <Bar dataKey="bot" fill={COLORS.bot} name="bot" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Shield className="mr-2 h-4 w-4 text-primary" />
              Threat Intelligence by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {threatLevels.map((country, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{country.country}</span>
                      <Badge variant={getRiskBadgeVariant(country.riskCategory)} className="text-xs">
                        {country.riskCategory} Risk
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {country.total} requests • {country.threatLevel}% bot traffic
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-destructive">
                      {country.bot} bots
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {country.human} human
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <BarChart3 className="mr-2 h-4 w-4 text-primary" />
              24-Hour Traffic Pattern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(hour) => `${hour}:00`}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(hour) => `${hour}:00`}
                  formatter={(value, name) => [value, name === 'human' ? 'Human' : 'Bot']}
                />
                <Area 
                  type="monotone" 
                  dataKey="human" 
                  stackId="1"
                  stroke={COLORS.human}
                  fill={COLORS.human}
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="bot" 
                  stackId="1"
                  stroke={COLORS.bot}
                  fill={COLORS.bot}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="mr-2 h-4 w-4 text-primary" />
              ISP Traffic Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {ispData.map((isp, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{isp.isp}</div>
                    <div className="text-xs text-muted-foreground">
                      {isp.total} requests
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="text-xs text-green-600">{isp.human}H</div>
                      <div className="text-xs text-red-600">{isp.bot}B</div>
                    </div>
                    <div className="w-16 bg-muted rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full"
                        style={{ 
                          width: `${Math.round((isp.bot / isp.total) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device and Browser Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Users className="mr-2 h-4 w-4 text-primary" />
              Device Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ device, percentage }) => `${device}: ${percentage}%`}
                  fontSize={12}
                >
                  {deviceData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? COLORS.primary : index === 1 ? COLORS.accent : COLORS.secondary} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Bot className="mr-2 h-4 w-4 text-primary" />
              Browser Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {browserData.slice(0, 6).map((browser, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{browser.browser}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${browser.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8">
                      {browser.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}