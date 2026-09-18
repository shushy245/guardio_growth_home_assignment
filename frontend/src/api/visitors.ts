import { visitorModel } from '~/models';
// Visitor endpoints. Responses are typed with the wire DTO and mapped through the model
// translator, so nothing past this file sees a raw body.
import { httpClient } from '~/api/http-client';
import type { VisitorDTO, VisitorModel } from '~/models/visitor';

export const createVisitor = async (): Promise<VisitorModel> => {
    const response = await httpClient.post<VisitorDTO>('/visitors');

    return visitorModel.fromDTO(response.data);
};

export const fetchVisitor = async ({ id }: { id: string }): Promise<VisitorModel> => {
    const response = await httpClient.get<VisitorDTO>(`/visitors/${encodeURIComponent(id)}`);

    return visitorModel.fromDTO(response.data);
};
