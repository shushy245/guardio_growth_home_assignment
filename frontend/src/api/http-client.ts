// The one place axios is imported. Everything else imports httpClient from here.
import axios from 'axios';

import { normaliseNulls } from '~/api/http-client.utils';

export const httpClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

httpClient.interceptors.response.use((response) => {
    response.data = normaliseNulls(response.data);

    return response;
});
