import { OutputBlockModel } from "./output-block.model";

/**
 * It's a set of OutputBlocks
 */
export class OutputProfileModel {
    public name: string;
    public outputBlocks: OutputBlockModel[] = [];

    /**
     * @returns true when there is a block that requires the interaction with the UI
     */
    static HasBlockingOutputComponents(outputProfile: OutputProfileModel): boolean {
        return outputProfile.outputBlocks.findIndex(x => x.value == 'quantity' || x.type == 'select_option') != -1;
    }
}
