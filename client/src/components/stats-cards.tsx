import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Code, Bot, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Stats {
  totalClassifications: number;
  humanVisitors: number;
  botTraffic: number;
  apiRequests: number;
}

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const cards = [
    {
      title: "Total Classifications",
      value: stats?.totalClassifications ?? 0,
      icon: BarChart3,
      color: "bg-primary",
      change: "+12%",
      changeLabel: "from last hour"
    },
    {
      title: "Human Visitors",
      value: stats?.humanVisitors ?? 0,
      icon: User,
      color: "bg-green-500",
      change: stats?.totalClassifications ? `${Math.round((stats.humanVisitors / stats.totalClassifications) * 100)}%` : "0%",
      changeLabel: "of total traffic"
    },
    {
      title: "Bot Traffic",
      value: stats?.botTraffic ?? 0,
      icon: Bot,
      color: "bg-orange-500",
      change: stats?.totalClassifications ? `${Math.round((stats.botTraffic / stats.totalClassifications) * 100)}%` : "0%",
      changeLabel: "of total traffic"
    },
    {
      title: "API Requests",
      value: stats?.apiRequests ?? 0,
      icon: Code,
      color: "bg-yellow-500",
      change: "+24%",
      changeLabel: "from yesterday"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow border border-border">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <Card key={index} className="shadow border border-border" data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{card.title}</p>
                <p className={`text-2xl font-bold ${index === 1 ? 'text-green-600' : index === 2 ? 'text-orange-600' : 'text-foreground'}`}>
                  {card.value.toLocaleString()}
                </p>
              </div>
              <div className={`${card.color} bg-opacity-10 p-3 rounded-lg`}>
                <card.icon className={`h-5 w-5 ${
                  index === 0 ? 'text-primary' : 
                  index === 1 ? 'text-green-600' : 
                  index === 2 ? 'text-orange-600' : 
                  'text-yellow-600'
                }`} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={`font-medium ${
                index === 1 ? 'text-green-600' : 
                index === 2 ? 'text-orange-600' : 
                'text-green-600'
              }`}>
                {card.change}
              </span>
              <span className="text-muted-foreground ml-1">{card.changeLabel}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
