// Builder for the catalog request: what the provider's effects answer — which page of which
// selection, and how many times it has been retried.

import {
    type CatalogFilters,
    type CatalogRequest,
    FIRST_PAGE,
    NO_FILTERS,
} from '~/providers/BreachCatalogProvider.utils';

const AN_ENABLED_FIRST_PAGE: CatalogRequest = {
    isEnabled: true,
    attempt: 0,
    filters: NO_FILTERS,
    page: FIRST_PAGE,
};

class CatalogRequestBuilder {
    private state: CatalogRequest = { ...AN_ENABLED_FIRST_PAGE };

    forPage(page: number): this {
        this.state = { ...this.state, page };

        return this;
    }

    withFilters(filters: CatalogFilters): this {
        this.state = { ...this.state, filters };

        return this;
    }

    build(): CatalogRequest {
        return this.state;
    }
}

export const aCatalogRequest = (): CatalogRequestBuilder => new CatalogRequestBuilder();
