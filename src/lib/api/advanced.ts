import "server-only";
import { financialActor } from "./finance";
import { prisma } from "../db/prisma";
import { advancedService } from "../../services/advanced";
export async function advancedContext(request: Request) { return advancedService(prisma, await financialActor(request)); }
