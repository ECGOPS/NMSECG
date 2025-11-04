import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Trash2, Edit, Plus, Calendar, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { BroadcastMessage, BroadcastMessageFormData } from "@/lib/types/broadcast";
import { broadcastService } from "@/services/broadcastService";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { format } from "date-fns";

export default function BroadcastManager() {
  const { user } = useAzureADAuth();
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<BroadcastMessage | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalMessages, setTotalMessages] = useState(0);
  const [formData, setFormData] = useState<BroadcastMessageFormData>({
    title: "",
    message: "",
    imageUrl: "",
    videoUrl: "",
    active: false,
    startDate: "",
    endDate: "",
  });

  // Check if user has admin access
  const isAdmin = user?.role === "system_admin" || user?.role === "global_engineer";

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      return;
    }
    loadMessages(currentPage, pageSize);
  }, [isAdmin, currentPage, pageSize]);

  const loadMessages = async (page: number = currentPage, size: number = pageSize) => {
    try {
      setIsLoading(true);
      const pageMessages = await broadcastService.getAllMessages(page, size);
      // Messages are already sorted by backend (ORDER BY createdAt DESC)
      setMessages(pageMessages);
      
      // Fetch total count if not already set or if page changed
      if (totalMessages === 0 || page === 1) {
        const total = await broadcastService.getTotalCount();
        setTotalMessages(total);
      }
    } catch (error) {
      console.error("[BroadcastManager] Error loading messages:", error);
      toast.error("Failed to load broadcast messages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (message?: BroadcastMessage) => {
    if (message) {
      setEditingMessage(message);
      setFormData({
        title: message.title,
        message: message.message,
        imageUrl: message.imageUrl || "",
        videoUrl: message.videoUrl || "",
        active: message.active,
        startDate: message.startDate || "",
        endDate: message.endDate || "",
      });
    } else {
      setEditingMessage(null);
      setFormData({
        title: "",
        message: "",
        imageUrl: "",
        videoUrl: "",
        active: false,
        startDate: "",
        endDate: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMessage(null);
    setFormData({
      title: "",
      message: "",
      imageUrl: "",
      videoUrl: "",
      active: false,
      startDate: "",
      endDate: "",
      targetRoles: [],
      targetRegions: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error("Please fill in title and message");
      return;
    }

    try {
      if (editingMessage) {
        await broadcastService.updateMessage(editingMessage.id, formData);
        toast.success("Broadcast message updated successfully");
      } else {
        await broadcastService.createMessage(formData);
        toast.success("Broadcast message created successfully");
      }
      
      handleCloseDialog();
      loadMessages(currentPage, pageSize);
      // Refresh count
      broadcastService.getTotalCount().then(total => setTotalMessages(total));
    } catch (error) {
      console.error("[BroadcastManager] Error saving message:", error);
      toast.error("Failed to save broadcast message");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this broadcast message?")) {
      return;
    }

    try {
      await broadcastService.deleteMessage(id);
      toast.success("Broadcast message deleted successfully");
      loadMessages(currentPage, pageSize);
      // Refresh count
      broadcastService.getTotalCount().then(total => setTotalMessages(total));
    } catch (error) {
      console.error("[BroadcastManager] Error deleting message:", error);
      toast.error("Failed to delete broadcast message");
    }
  };

  const handleToggleActive = async (message: BroadcastMessage) => {
    try {
      await broadcastService.updateMessage(message.id, { active: !message.active });
      toast.success(`Message ${!message.active ? "activated" : "deactivated"}`);
      loadMessages(currentPage, pageSize);
    } catch (error) {
      console.error("[BroadcastManager] Error toggling active:", error);
      toast.error("Failed to update message");
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Access denied. Admin privileges required.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Broadcast Manager</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage global announcements for all users
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Broadcast Messages</CardTitle>
            <CardDescription>
              Manage announcements that appear to users on login or app start
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No broadcast messages yet. Create one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Media</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="font-medium">{message.title}</TableCell>
                      <TableCell>
                        <Badge variant={message.active ? "default" : "secondary"}>
                          {message.active ? (
                            <>
                              <Eye className="mr-1 h-3 w-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <EyeOff className="mr-1 h-3 w-3" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {message.createdAt 
                          ? (() => {
                              try {
                                const date = new Date(message.createdAt);
                                if (isNaN(date.getTime())) {
                                  return "Invalid date";
                                }
                                return format(date, "MMM d, yyyy HH:mm");
                              } catch (error) {
                                return "Invalid date";
                              }
                            })()
                          : "No date"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {message.imageUrl && (
                            <Badge variant="outline">Image</Badge>
                          )}
                          {message.videoUrl && (
                            <Badge variant="outline">Video</Badge>
                          )}
                          {!message.imageUrl && !message.videoUrl && (
                            <span className="text-xs text-muted-foreground">Text only</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          Global
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(message)}
                          >
                            {message.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(message)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(message.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {/* Pagination Controls */}
            {!isLoading && messages.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalMessages)} of {totalMessages} messages
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pageSize" className="text-sm whitespace-nowrap">Per page:</Label>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1); // Reset to first page when changing page size
                      }}
                    >
                      <SelectTrigger id="pageSize" className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoading}
                      className="h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Previous</span>
                    </Button>
                    
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm">
                        Page {currentPage} of {Math.ceil(totalMessages / pageSize) || 1}
                      </span>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage >= Math.ceil(totalMessages / pageSize) || isLoading}
                      className="h-8"
                    >
                      <span className="hidden sm:inline mr-1">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMessage ? "Edit Broadcast Message" : "Create Broadcast Message"}
              </DialogTitle>
              <DialogDescription>
                Create a global announcement that will appear to all users on login or app start.
                Only one message can be active at a time.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Enter announcement message"
                  rows={5}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="videoUrl">Video URL (Optional)</Label>
                  <Input
                    id="videoUrl"
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="YouTube or Vimeo URL"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports YouTube and Vimeo links
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    <Calendar className="inline mr-1 h-4 w-4" />
                    Start Date (Optional)
                  </Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    <Calendar className="inline mr-1 h-4 w-4" />
                    End Date (Optional)
                  </Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, active: checked })
                  }
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Activate this message (will deactivate others)
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingMessage ? "Update" : "Create"} Message
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

