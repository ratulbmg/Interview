import { Prisma } from "@repo/db/client";

type RepositoryModel<
  T,
  CreateData = Prisma.InputJsonValue,
  UpdateData = CreateData,
> = {
  findMany(): Promise<T[]>;
  findUnique(args: { where: { id: number } }): Promise<T | null>;
  create(args: { data: CreateData }): Promise<T>;
  update(args: { where: { id: number }; data: UpdateData }): Promise<T>;
  delete(args: { where: { id: number } }): Promise<T>;
};

export class BaseRepository<
  T,
  CreateData = Prisma.InputJsonValue,
  UpdateData = CreateData,
> {
  protected model: RepositoryModel<T, CreateData, UpdateData>;

  constructor(model: RepositoryModel<T, CreateData, UpdateData>) {
    this.model = model;
  }

  async findAll(): Promise<T[]> {
    return this.model.findMany();
  }

  async findById(id: number): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  async create(data: CreateData): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: number, data: UpdateData): Promise<T> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: number): Promise<T> {
    return this.model.delete({ where: { id } });
  }
}
