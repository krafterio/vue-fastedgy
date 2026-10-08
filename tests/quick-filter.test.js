/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, reactive, ref } from 'vue';
import { defineQuickFilter, readQuickFilters, writeQuickFilters } from '../composables/quick-filter.js';

const CLOSED = { name: 'closed', default: false, filter: (shown) => (shown ? null : ['status', '=', 'opened']) };
const CONVERSATION = { name: 'conversation', default: 'all', filter: () => null };

describe('quick filters', () => {
    it('read the url at their default, unless it says otherwise, and keep in it those away from it', () => {
        expect(readQuickFilters(undefined, [CLOSED, CONVERSATION])).toEqual({ closed: false, conversation: 'all' });
        expect(readQuickFilters('{"closed":true,"gone":1}', [CLOSED, CONVERSATION])).toEqual({
            closed: true,
            conversation: 'all',
        });
        expect(readQuickFilters('not json', [CLOSED])).toEqual({ closed: false });

        expect(writeQuickFilters({ closed: false, conversation: 'all' }, [CLOSED, CONVERSATION])).toBeNull();
        expect(writeQuickFilters({ closed: true, conversation: 'all' }, [CLOSED, CONVERSATION])).toBe(
            '{"closed":true}'
        );
    });

    it('draw any component speaking v-model on the value of their list, and write back what it changes', async () => {
        const label = ref('Closed tickets');
        const Toggle = defineComponent({
            props: ['modelValue', 'label'],
            emits: ['update:modelValue'],
            setup:
                (props, { emit }) =>
                () =>
                    h(
                        'button',
                        { onClick: () => emit('update:modelValue', !props.modelValue) },
                        `${props.label}: ${props.modelValue}`
                    ),
        });
        const ClosedTickets = defineQuickFilter(CLOSED, Toggle, () => ({ label: label.value }));
        const list = { quick: reactive({ closed: false }) };

        const wrapper = mount(ClosedTickets, { props: { list } });

        expect(ClosedTickets.quickFilter).toBe(CLOSED);
        expect(wrapper.text()).toBe('Closed tickets: false');

        await wrapper.find('button').trigger('click');
        label.value = 'Tickets fermés';
        await wrapper.vm.$nextTick();

        expect(list.quick.closed).toBe(true);
        expect(wrapper.text()).toBe('Tickets fermés: true');
    });
});
