export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";
import type {
  ApiError,
  GetJobResponse,
  UpdateJobRequest,
  UpdateJobResponse,
} from "@/lib/scraper/api-types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  const { jobId } = await context.params;
  const job = await getRepository().getStoredJob(jobId);

  if (!job) {
    const err: ApiError = { error: "Job not found" };
    return NextResponse.json(err, { status: 404 });
  }

  const body: GetJobResponse = { job };
  return NextResponse.json(body);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const __auth = await requireApiUser(request);
  if (__auth.response) return __auth.response;

  const { jobId } = await context.params;

  let body: UpdateJobRequest;
  try {
    body = (await request.json()) as UpdateJobRequest;
  } catch {
    const err: ApiError = { error: "Invalid JSON body" };
    return NextResponse.json(err, { status: 400 });
  }

  if (!["pause", "resume", "cancel"].includes(body.action)) {
    const err: ApiError = {
      error: "action must be pause, resume, or cancel",
    };
    return NextResponse.json(err, { status: 400 });
  }

  const existing = await getRepository().getStoredJob(jobId);
  if (!existing) {
    const err: ApiError = { error: "Job not found" };
    return NextResponse.json(err, { status: 404 });
  }

  const updated = await getRepository().updateStoredJobStatus(jobId, body.action);
  if (!updated) {
    const err: ApiError = {
      error: `Cannot ${body.action} job in status "${existing.status}"`,
    };
    return NextResponse.json(err, { status: 409 });
  }

  const response: UpdateJobResponse = { job: updated };
  return NextResponse.json(response);
}
