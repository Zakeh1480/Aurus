import {
  UpdateProfileRequestSchema,
  type Profile,
  type UpdateProfileRequest,
  type User,
  type UserDataExport,
} from "@aurafarming/shared";
import { Body, Controller, Delete, Get, HttpCode, Patch, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@Controller("users/me")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("profile")
  getProfile(@CurrentUser() user: User): Promise<Profile> {
    return this.usersService.getProfile(user.id);
  }

  @Patch("profile")
  updateProfile(
    @CurrentUser() user: User,
    // Pipe aplicado só ao parâmetro @Body() — um @UsePipes() de método roda contra
    // TODOS os parâmetros do handler, inclusive @CurrentUser(), o que corrompia
    // `user` (validado contra UpdateProfileRequestSchema, que não tem `id`/`email`).
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<Profile> {
    return this.usersService.updateProfile(user.id, body);
  }

  @Get("export")
  exportData(@CurrentUser() user: User): Promise<UserDataExport> {
    return this.usersService.exportData(user.id);
  }

  @Delete()
  @HttpCode(200)
  async remove(@CurrentUser() user: User): Promise<{ success: true }> {
    await this.usersService.remove(user.id);
    return { success: true };
  }
}
