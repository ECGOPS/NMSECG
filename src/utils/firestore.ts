import { apiRequest } from '@/lib/api';

export interface FirestoreDocument {
  id: string;
  [key: string]: any;
}

export interface FirestoreQuery {
  collection: string;
  filters?: {
    field: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value: any;
  }[];
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  offset?: number;
}

export class FirestoreService {
  private static instance: FirestoreService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api';
  }

  public static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  public async getDocument(collection: string, id: string): Promise<FirestoreDocument | null> {
    try {
      const document = await apiRequest(`${this.baseUrl}/${collection}/${id}`);
      return document;
    } catch (error) {
      console.error(`Error getting document from ${collection}/${id}:`, error);
      return null;
    }
  }

  public async getDocuments(query: FirestoreQuery): Promise<FirestoreDocument[]> {
    try {
      const params = new URLSearchParams();
      
      if (query.filters) {
        query.filters.forEach((filter, index) => {
          params.append(`filter[${index}][field]`, filter.field);
          params.append(`filter[${index}][operator]`, filter.operator);
          params.append(`filter[${index}][value]`, String(filter.value));
        });
      }
      
      if (query.orderBy) {
        params.append('sort', query.orderBy.field);
        params.append('order', query.orderBy.direction);
      }
      
      if (query.limit) {
        params.append('limit', query.limit.toString());
      }
      
      if (query.offset) {
        params.append('offset', query.offset.toString());
      }
      
      const documents = await apiRequest(`${this.baseUrl}/${query.collection}?${params.toString()}`);
      return documents;
    } catch (error) {
      console.error(`Error getting documents from ${query.collection}:`, error);
      return [];
    }
  }

  public async addDocument(collection: string, data: any): Promise<string> {
    try {
      const result = await apiRequest(`${this.baseUrl}/${collection}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result.id;
    } catch (error) {
      console.error(`Error adding document to ${collection}:`, error);
      throw error;
    }
  }

  public async updateDocument(collection: string, id: string, data: any): Promise<void> {
    try {
      await apiRequest(`${this.baseUrl}/${collection}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error(`Error updating document ${collection}/${id}:`, error);
      throw error;
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    try {
      await apiRequest(`${this.baseUrl}/${collection}/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error deleting document ${collection}/${id}:`, error);
      throw error;
    }
  }

  public async countDocuments(collection: string, filters?: FirestoreQuery['filters']): Promise<number> {
    try {
      const params = new URLSearchParams();
      params.append('countOnly', 'true');
      
      if (filters) {
        filters.forEach((filter, index) => {
          params.append(`filter[${index}][field]`, filter.field);
          params.append(`filter[${index}][operator]`, filter.operator);
          params.append(`filter[${index}][value]`, String(filter.value));
        });
      }
      
      const result = await apiRequest(`${this.baseUrl}/${collection}?${params.toString()}`);
      return result.count || 0;
    } catch (error) {
      console.error(`Error counting documents in ${collection}:`, error);
      return 0;
    }
  }
}

export const firestoreService = FirestoreService.getInstance(); 