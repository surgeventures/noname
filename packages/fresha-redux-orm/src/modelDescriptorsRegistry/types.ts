import { Attribute } from "../fields";
import { Descriptors } from '../types';

/**
 * Represents a map with descriptors for a specific model
 */
export type DescriptorsMap<DescriptorTypes extends Descriptors> = { id: Attribute } & { [DescriptorName: string]: DescriptorTypes }
