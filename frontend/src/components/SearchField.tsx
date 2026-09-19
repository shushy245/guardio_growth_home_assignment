// The design's SearchField. It owns what is in the box and tells the catalog what to search for
// once the visitor pauses — a word costs one request, not one per letter. The box is never
// rewritten from above while they type: the query only comes back down when something else on the
// page changed it (Clear filters), told apart from our own echo by the last query we sent.
import { type ChangeEvent, type ReactElement, useEffect, useRef, useState } from 'react';

import {
    SEARCH_DEBOUNCE_MS,
    SEARCH_LABEL,
    SEARCH_PLACEHOLDER,
    SearchFieldTestIds,
    toQuery,
} from '~/components/SearchField.utils';

import styles from '~/components/SearchField.module.scss';

export const SearchField = ({
    query,
    onSearch,
}: {
    query: string | undefined;
    onSearch: (query: string | undefined) => void;
}): ReactElement => {
    const [text, setText] = useState(query ?? '');
    // The query this field last asked for. When the prop comes back equal to it, that is our own
    // search echoed and the box is left alone; anything else is an outside change to adopt.
    const lastSent = useRef(query);
    // Read at the moment the pause ends, so the parent may hand a fresh handler every render
    // without restarting the pause.
    const onSearchRef = useRef(onSearch);

    useEffect(() => {
        onSearchRef.current = onSearch;
    }, [onSearch]);

    useEffect(() => {
        if (query === lastSent.current) return;
        lastSent.current = query;
        setText(query ?? '');
    }, [query]);

    useEffect(() => {
        const next = toQuery(text);
        if (next === lastSent.current) return;
        const timer = setTimeout(() => {
            lastSent.current = next;
            onSearchRef.current(next);
        }, SEARCH_DEBOUNCE_MS);

        return (): void => {
            clearTimeout(timer);
        };
    }, [text]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setText(event.target.value);
    };

    return (
        <input
            className={styles.input}
            type="search"
            name="q"
            inputMode="search"
            autoComplete="off"
            aria-label={SEARCH_LABEL}
            placeholder={SEARCH_PLACEHOLDER}
            value={text}
            data-testid={SearchFieldTestIds.Input}
            onChange={handleChange}
        />
    );
};
