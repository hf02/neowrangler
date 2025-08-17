import {
	LocalFilesystem,
	LocalFilesystemFile,
} from "../filesystem/LocalFilesystem";
import { MockNeocitiesApi } from "../neocities/MockNeocitiesApi";
import { NeocitiesFilesystem } from "../neocities/NeocitiesFilesystem";
import {
	BulkNeocitiesDeleteSyncAction,
	BulkNeocitiesUploadSyncAction,
} from "./SyncAction";
import { SyncActionPlan } from "./Synchronizer";

describe("SyncActionPlan", () => {
	test("uploads", async () => {
		const plan = new SyncActionPlan();

		const local = new LocalFilesystem("/");

		const batches = 5;

		for (let i = 0; i < plan.uploadBatchCount * batches; i++) {
			const file = local.createUncommittedFile(`test-${i}.txt`);
			local.addFile(file);
		}

		const api = new MockNeocitiesApi();
		const neocities = new NeocitiesFilesystem(api);

		await plan.diffFilesystems(local, neocities);

		expect(plan.actions).toHaveLength(batches);

		const firstAction = plan.actions[0] as BulkNeocitiesUploadSyncAction;

		expect(firstAction).toBeInstanceOf(BulkNeocitiesUploadSyncAction);

		expect(firstAction.force).toBe(false);

		expect(firstAction.toUpload).toHaveLength(plan.uploadBatchCount);
	});

	test("deletes", async () => {
		const plan = new SyncActionPlan();
		plan.shouldDelete = true;

		const api = new MockNeocitiesApi();
		const neocities = new NeocitiesFilesystem(api);

		const local = new LocalFilesystem("/");

		const batches = 5;

		for (let i = 0; i < plan.deleteBatchCount * batches; i++) {
			const file = neocities.createUncommittedFile(`test-${i}.txt`);
			neocities.addFile(file);
		}

		await plan.diffFilesystems(local, neocities);

		expect(plan.actions).toHaveLength(batches);

		const firstAction = plan.actions[0] as BulkNeocitiesDeleteSyncAction;

		expect(firstAction).toBeInstanceOf(BulkNeocitiesDeleteSyncAction);

		expect(firstAction.toDelete).toHaveLength(plan.deleteBatchCount);
	});

	test("doesn't delete by default", async () => {
		const plan = new SyncActionPlan();
		plan.shouldOverwrite = true;

		const local1 = new LocalFilesystem("/");
		const local2 = new LocalFilesystem("/");

		const file2 = local2.createUncommittedFile(`test.txt`);
		local2.addFile(file2);

		await plan.diffFilesystems(local1, local2);

		expect(plan.actions).toHaveLength(0);
	});

	test("doesn't overwrite by default", async () => {
		const plan = new SyncActionPlan();
		plan.shouldDelete = true;

		const local = new LocalFilesystem("./test");
		const realFile = local.createUncommittedFile("index.html");
		local.addFile(realFile);

		const api = new MockNeocitiesApi();
		const neocities = new NeocitiesFilesystem(api);

		const mockFile = neocities.createUncommittedFile("index.html");
		neocities.addFile(mockFile);

		await plan.diffFilesystems(local, neocities);

		expect(plan.actions).toHaveLength(0);
	});

	test("doesn't delete supporter files by default", async () => {
		const plan = new SyncActionPlan();
		plan.shouldDelete = true;

		const local1 = new LocalFilesystem("/");
		const local2 = new LocalFilesystem("/");

		const file2 = local2.createUncommittedFile(`test.mp3`);
		local2.addFile(file2);

		await plan.diffFilesystems(local1, local2);

		expect(plan.actions).toHaveLength(0);
	});

	test("uploads on hash mismatch", async () => {
		const plan = new SyncActionPlan();
		plan.shouldOverwrite = true;

		const local = new LocalFilesystem("./test");
		const realFile = local.createUncommittedFile("index.html");
		local.addFile(realFile);

		const api = new MockNeocitiesApi();
		const neocities = new NeocitiesFilesystem(api);

		const mockFile = neocities.createUncommittedFile("index.html");
		neocities.addFile(mockFile);

		await plan.diffFilesystems(local, neocities);

		expect(plan.actions).toHaveLength(1);

		const firstAction = plan.actions[0] as BulkNeocitiesUploadSyncAction;

		expect(firstAction).toBeInstanceOf(BulkNeocitiesUploadSyncAction);

		expect(firstAction.force).toBe(true);

		expect(firstAction.toUpload[0]).toBe(realFile);
	});
});
