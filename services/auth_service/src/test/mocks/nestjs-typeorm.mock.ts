export const InjectRepository = () => {
  return () => {
    return undefined;
  };
};

export const TypeOrmModule = {
  forFeature: () => ({
    module: class MockTypeOrmFeatureModule {},
    providers: [],
    exports: [],
  }),
};
