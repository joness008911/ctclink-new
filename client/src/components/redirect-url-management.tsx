import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface RedirectUrls {
  humanUrl: string;
  botUrl: string;
}

export default function RedirectUrlManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: urls, isLoading } = useQuery<RedirectUrls>({
    queryKey: ["/api/redirect-urls"],
  });

  const [humanUrl, setHumanUrl] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Update local state when data is loaded
  useEffect(() => {
    if (urls) {
      setHumanUrl(urls.humanUrl);
      setBotUrl(urls.botUrl);
    }
  }, [urls]);

  const updateUrlsMutation = useMutation({
    mutationFn: async (data: RedirectUrls) => {
      const response = await apiRequest("PUT", "/api/redirect-urls", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Redirect URLs updated successfully",
        variant: "default",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/redirect-urls"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update redirect URLs",
        variant: "destructive",
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!humanUrl.trim() || !botUrl.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter valid URLs for both fields",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(humanUrl);
      new URL(botUrl);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter valid URLs (must start with http:// or https://)",
        variant: "destructive",
      });
      return;
    }

    updateUrlsMutation.mutate({ humanUrl: humanUrl.trim(), botUrl: botUrl.trim() });
  };

  if (isLoading) {
    return (
      <Card className="shadow border border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            <ExternalLink className="text-primary mr-2 inline h-5 w-5" />
            Redirect URLs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow border border-border" data-testid="card-redirect-urls">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          <ExternalLink className="text-primary mr-2 inline h-5 w-5" />
          Redirect URLs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-foreground">Human Redirect URL:</span>
                <div className="mt-1 bg-muted rounded-md p-2 text-sm text-muted-foreground break-all">
                  {urls?.humanUrl || "Not set"}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-foreground">Bot Redirect URL:</span>
                <div className="mt-1 bg-muted rounded-md p-2 text-sm text-muted-foreground break-all">
                  {urls?.botUrl || "Not set"}
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setHumanUrl(urls?.humanUrl || "");
                setBotUrl(urls?.botUrl || "");
                setIsEditing(true);
              }}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-edit-urls"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Update URLs
            </Button>
          </>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="humanUrl" className="text-sm font-medium">
                Human Redirect URL
              </Label>
              <Input
                id="humanUrl"
                type="url"
                value={humanUrl}
                onChange={(e) => setHumanUrl(e.target.value)}
                placeholder="https://yoursite.com/human"
                className="text-sm"
                data-testid="input-human-url"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Where to redirect human visitors
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="botUrl" className="text-sm font-medium">
                Bot Redirect URL
              </Label>
              <Input
                id="botUrl"
                type="url"
                value={botUrl}
                onChange={(e) => setBotUrl(e.target.value)}
                placeholder="https://yoursite.com/bot"
                className="text-sm"
                data-testid="input-bot-url"
              />
              <p className="text-xs text-muted-foreground">
                Where to redirect bot traffic
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                type="submit"
                size="sm"
                disabled={updateUrlsMutation.isPending || !humanUrl.trim() || !botUrl.trim()}
                className="flex-1"
                data-testid="button-save-urls"
              >
                {updateUrlsMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setHumanUrl(urls?.humanUrl || "");
                  setBotUrl(urls?.botUrl || "");
                }}
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid="button-cancel-edit-urls"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="bg-muted/50 p-3 rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Redirect Configuration:</strong> Set where visitors are sent based on their classification.
            Human visitors go to the first URL, bots to the second.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
