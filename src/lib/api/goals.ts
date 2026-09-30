import "server-only";
import { financialActor } from "./finance";
import { prisma } from "../db/prisma";
import { goalsService } from "../../services/goals";
export async function goalsContext(request: Request) { return goalsService(prisma, await financialActor(request)); }
